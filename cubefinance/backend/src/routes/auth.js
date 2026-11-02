// ============================================================================
// Registration + email verification.
//
//   POST /api/auth/register   { email }            → mails a 4-digit code
//   POST /api/auth/verify     { email, code }      → marks the email verified
//   POST /api/auth/resend     { email }            → new code, invalidates old
//   GET  /api/auth/status     ?email=              → { verified }
//
// Every response is deliberately vague about whether an address exists. An
// endpoint that says "no such user" hands attackers a free list of your
// customers, so register/resend always answer the same way.
// ============================================================================

const express = require('express');
const {
  createChallenge,
  verifyChallenge,
  normaliseEmail,
  isValidEmail,
  TTL_MS,
  MAX_ATTEMPTS,
} = require('../auth/otp');
const limiter = require('../auth/rateLimit');
const { sendVerificationCode, TRANSPORT } = require('../auth/mailer');

const router = express.Router();

// --- storage ---------------------------------------------------------------
// In-memory for now: one pending challenge per email, plus the set of verified
// addresses. Swap both for your database/Redis in production — the shape is
// small on purpose. Records are swept so the maps can't grow unbounded.
const challenges = new Map();  // email -> record
const verified = new Set();    // emails that completed verification

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [email, rec] of challenges) {
    if (now > rec.expiresAt + 60_000) challenges.delete(email);
  }
}, 5 * 60 * 1000);
if (sweeper.unref) sweeper.unref();

// --- helpers ---------------------------------------------------------------
const genericSent = (res, extra = {}) =>
  res.json({
    ok: true,
    message: 'אם הכתובת תקינה, נשלח אליה קוד אימות בן 4 ספרות.',
    expiresInSec: Math.floor(TTL_MS / 1000),
    ...extra,
  });

async function issueCode(email, res, req) {
  const ip = limiter.clientIp(req);

  const perEmail = limiter.hit('sendPerEmail', email);
  const perIp = limiter.hit('sendPerIp', ip);
  if (!perEmail.allowed || !perIp.allowed) {
    const retry = Math.max(perEmail.retryAfterSec, perIp.retryAfterSec);
    res.set('Retry-After', String(retry));
    return res.status(429).json({
      ok: false,
      error: 'rate_limited',
      message: 'נשלחו יותר מדי קודים. נסו שוב מאוחר יותר.',
      retryAfterSec: retry,
    });
  }

  const { code, record } = createChallenge(email);
  challenges.set(email, record);          // a new code always replaces the old

  const sent = await sendVerificationCode(email, code);
  if (!sent.ok) {
    return res.status(502).json({
      ok: false,
      error: 'send_failed',
      message: 'שליחת המייל נכשלה. נסו שוב בעוד רגע.',
    });
  }

  // In dev (console transport) return the code so the flow is testable without
  // a mailbox. This can NEVER happen with a real transport.
  const extra = (TRANSPORT === 'console' && process.env.NODE_ENV !== 'production')
    ? { devCode: code }
    : {};
  return genericSent(res, extra);
}

// --- POST /api/auth/register ----------------------------------------------
router.post('/register', async (req, res) => {
  const email = normaliseEmail(req.body?.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email', message: 'כתובת אימייל לא תקינה.' });
  }
  if (verified.has(email)) {
    // Already verified — same generic answer, no enumeration signal.
    return genericSent(res, { alreadyVerified: true });
  }
  return issueCode(email, res, req);
});

// --- POST /api/auth/resend -------------------------------------------------
router.post('/resend', async (req, res) => {
  const email = normaliseEmail(req.body?.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email', message: 'כתובת אימייל לא תקינה.' });
  }
  return issueCode(email, res, req);
});

// --- POST /api/auth/verify -------------------------------------------------
router.post('/verify', (req, res) => {
  const email = normaliseEmail(req.body?.email);
  const code = String(req.body?.code || '');
  const ip = limiter.clientIp(req);

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email', message: 'כתובת אימייל לא תקינה.' });
  }

  const ipLimit = limiter.hit('verifyPerIp', ip);
  if (!ipLimit.allowed) {
    res.set('Retry-After', String(ipLimit.retryAfterSec));
    return res.status(429).json({
      ok: false, error: 'rate_limited',
      message: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
      retryAfterSec: ipLimit.retryAfterSec,
    });
  }

  const record = challenges.get(email);
  const result = verifyChallenge(record, code);

  if (result.ok) {
    challenges.delete(email);              // one-time: burn it
    verified.add(email);
    limiter.reset('sendPerEmail', email);  // a real user, clear their bucket
    return res.json({
      ok: true,
      verified: true,
      message: 'האימייל אומת בהצלחה.',
      next: 'survey',                      // the client moves to the questionnaire
    });
  }

  const messages = {
    no_code: 'לא נמצא קוד פעיל לכתובת הזו. בקשו קוד חדש.',
    expired: 'הקוד פג תוקף. בקשו קוד חדש.',
    already_used: 'הקוד הזה כבר נוצל. בקשו קוד חדש.',
    too_many_attempts: 'יותר מדי ניסיונות שגויים. בקשו קוד חדש.',
    invalid: 'הקוד שגוי. בדקו את הספרות ונסו שוב.',
  };
  const status = result.reason === 'invalid' ? 400 : 410; // 410: needs a new code
  return res.status(status).json({
    ok: false,
    error: result.reason,
    message: messages[result.reason] || 'האימות נכשל.',
    attemptsLeft: typeof result.attemptsLeft === 'number' ? result.attemptsLeft : 0,
    maxAttempts: MAX_ATTEMPTS,
    canResend: true,
  });
});

// --- GET /api/auth/status --------------------------------------------------
router.get('/status', (req, res) => {
  const email = normaliseEmail(req.query?.email);
  if (!isValidEmail(email)) return res.status(400).json({ ok: false, error: 'invalid_email' });
  res.json({ ok: true, verified: verified.has(email) });
});

module.exports = router;
module.exports._internal = { challenges, verified };
