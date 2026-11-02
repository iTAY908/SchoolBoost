// ============================================================================
// One-time email verification codes.
//
// Design notes that matter:
//  * The code is generated with crypto.randomInt — a CSPRNG. Math.random() is
//    predictable and must never be used for anything security-related.
//  * Only a salted SHA-256 hash of the code is stored, never the digits. If the
//    store leaks, the codes are not sitting there in plaintext.
//  * BE HONEST about the limit: a 4-digit code has only 10,000 possibilities,
//    so hashing does NOT protect it against an attacker who can brute force
//    offline. What actually protects the account is the short expiry, the hard
//    attempt cap, and rate limiting. Hashing is defence in depth, not the wall.
//  * Comparison is constant-time so response timing can't leak the code.
// ============================================================================

const crypto = require('crypto');

const CODE_LENGTH = 4;
const TTL_MS = 10 * 60 * 1000;   // codes expire after 10 minutes
const MAX_ATTEMPTS = 5;          // wrong guesses allowed before the code dies

/**
 * A cryptographically random 4-digit code, zero padded ("0421" is valid).
 * @returns {string}
 */
function generateCode() {
  const max = 10 ** CODE_LENGTH;                 // 10000
  const n = crypto.randomInt(0, max);            // uniform, no modulo bias
  return String(n).padStart(CODE_LENGTH, '0');
}

/** Salted hash of a code. The salt is per-code, so identical codes differ. */
function hashCode(code, salt) {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

/** Timing-safe string comparison. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Build the record to persist. The plaintext code is returned separately so the
 * caller can mail it — it is never part of the stored record.
 */
function createChallenge(email) {
  const code = generateCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const record = {
    email: normaliseEmail(email),
    codeHash: hashCode(code, salt),
    salt,
    createdAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
    consumed: false,
  };
  return { code, record };
}

/**
 * Validate a submitted code against a stored record.
 * @returns {{ok: boolean, reason?: string, attemptsLeft?: number}}
 */
function verifyChallenge(record, submitted) {
  if (!record) return { ok: false, reason: 'no_code' };
  if (record.consumed) return { ok: false, reason: 'already_used' };
  if (Date.now() > record.expiresAt) return { ok: false, reason: 'expired' };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  const clean = String(submitted || '').replace(/\D/g, '');
  if (clean.length !== CODE_LENGTH) {
    record.attempts += 1;
    return { ok: false, reason: 'invalid', attemptsLeft: MAX_ATTEMPTS - record.attempts };
  }

  const candidate = hashCode(clean, record.salt);
  if (!safeEqual(candidate, record.codeHash)) {
    record.attempts += 1;
    return { ok: false, reason: 'invalid', attemptsLeft: MAX_ATTEMPTS - record.attempts };
  }

  record.consumed = true;   // one-time: a correct code can't be replayed
  return { ok: true };
}

const normaliseEmail = (e) => String(e || '').trim().toLowerCase();

const isValidEmail = (e) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliseEmail(e));

module.exports = {
  CODE_LENGTH,
  TTL_MS,
  MAX_ATTEMPTS,
  generateCode,
  hashCode,
  safeEqual,
  createChallenge,
  verifyChallenge,
  normaliseEmail,
  isValidEmail,
};
