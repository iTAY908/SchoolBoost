// ============================================================================
// Email verification for the web version — runs as Vercel serverless functions.
//
//   POST /api/auth/register  { email }               → mails a 6-digit code, returns { token }
//   POST /api/auth/resend    { email }               → same, a fresh code + token
//   POST /api/auth/verify    { email, code, token }  → { ok: true } when the code matches
//
// Serverless functions keep no memory between requests, so nothing is stored:
// the token carries the email and the expiry, signed with HMAC over the code.
// Without CODE_SECRET nobody can mint or check a token, and the code itself
// never leaves the server except in the email.
//
// Environment (Vercel → Project → Settings → Environment Variables):
//   CODE_SECRET          long random string (required)
//   GMAIL_USER           your Gmail address            ┐ send through Gmail
//   GMAIL_APP_PASSWORD   a 16-character App Password   ┘ (needs 2-Step Verification)
//   RESEND_API_KEY       alternative: send through Resend instead of Gmail
//   MAIL_FROM            optional sender, e.g. "CubeFinance <you@gmail.com>"
// ============================================================================

const crypto = require("crypto");

const CODE_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000;        // a code lives 10 minutes
const MAX_ATTEMPTS = 5;               // wrong guesses per code (best effort, see below)
const SENDS_PER_HOUR = 5;             // codes per email address per hour (best effort)

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

const normEmail = (e) => String(e || "").trim().toLowerCase();
const validEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function secret() {
  const s = process.env.CODE_SECRET;
  return s && s.length >= 16 ? s : null;
}

function sign(payload64, code) {
  return b64url(crypto.createHmac("sha256", secret()).update(payload64 + "." + code).digest());
}

function newChallenge(email) {
  const code = String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
  const payload = { e: email, x: Date.now() + TTL_MS, n: b64url(crypto.randomBytes(9)) };
  const p64 = b64url(JSON.stringify(payload));
  return { code, token: p64 + "." + sign(p64, code), expiresInSec: TTL_MS / 1000 };
}

// These two maps only live as long as one warm function instance, so they slow
// a guesser down rather than stop one. With 1,000,000 possible codes and a
// 10-minute life, that is still a very poor bet for an attacker.
const attempts = new Map();   // token nonce -> wrong guesses
const sends = new Map();      // email -> [timestamps]

function checkCode(email, code, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, reason: "no_code" };
  let payload;
  try { payload = JSON.parse(fromB64url(parts[0]).toString("utf8")); } catch (e) { return { ok: false, reason: "no_code" }; }
  if (!payload || payload.e !== email) return { ok: false, reason: "no_code" };
  if (Date.now() > payload.x) return { ok: false, reason: "expired" };
  const used = attempts.get(payload.n) || 0;
  if (used >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  const clean = String(code || "").replace(/\D/g, "");
  const want = Buffer.from(sign(parts[0], clean));
  const got = Buffer.from(parts[1]);
  if (clean.length === CODE_LENGTH && want.length === got.length && crypto.timingSafeEqual(want, got)) {
    attempts.set(payload.n, MAX_ATTEMPTS); // one-time on this instance
    return { ok: true };
  }
  attempts.set(payload.n, used + 1);
  return { ok: false, reason: "invalid", attemptsLeft: MAX_ATTEMPTS - used - 1 };
}

function allowSend(email) {
  const now = Date.now();
  const list = (sends.get(email) || []).filter((t) => now - t < 3600 * 1000);
  if (list.length >= SENDS_PER_HOUR) return false;
  list.push(now); sends.set(email, list);
  return true;
}

function buildMessage(code) {
  const subject = "קוד האימות שלך ל-CubeFinance: " + code;
  const text = "קוד האימות שלך ל-CubeFinance הוא: " + code + "\n\n" +
    "הקוד תקף ל-10 דקות.\nאם לא ביקשת את הקוד — אפשר להתעלם מהמייל.";
  const html =
    '<div dir="rtl" style="font-family:Segoe UI,Arial,\'Noto Sans Hebrew\',sans-serif;background:#f4f6fc;padding:28px">' +
      '<div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e2e6f3">' +
        '<div style="font-size:22px;font-weight:800;color:#171a2b">🧊 CubeFinance</div>' +
        '<p style="color:#5c6280;font-size:15px;line-height:1.7;margin:18px 0 8px">זה קוד האימות שלך. הוא תקף ל-<b>10 דקות</b>:</p>' +
        '<div style="font-size:36px;font-weight:900;letter-spacing:10px;color:#4f5dff;text-align:center;padding:18px;background:#f2f4ff;border-radius:14px;direction:ltr">' + code + '</div>' +
        '<p style="color:#8a90ab;font-size:12.5px;line-height:1.7;margin-top:20px">לא ביקשת את הקוד? אפשר להתעלם מהמייל — אף אחד לא יכול להשתמש בכתובת שלך בלי הקוד הזה.</p>' +
      '</div></div>';
  return { subject, text, html };
}

function mailConfigured() {
  return !!(process.env.RESEND_API_KEY || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));
}

async function sendMail(to, code) {
  const { subject, text, html } = buildMessage(code);
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "CubeFinance <onboarding@resend.dev>", to: [to], subject, text, html }),
    });
    if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200));
    return;
  }
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, "") },
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM || "CubeFinance <" + process.env.GMAIL_USER + ">", to, subject, text, html });
}

// The page also runs inside the Android app (file://) and other hosts, so the
// endpoints answer cross-origin. No cookies are involved, so "*" is safe here.
function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, message: "Method not allowed" }); return true; }
  return false;
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; }
}

/** Shared handler for register + resend. */
async function issue(req, res) {
  if (cors(req, res)) return;
  const email = normEmail(readBody(req).email);
  if (!validEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email", message: "כתובת אימייל לא תקינה." });
  if (!secret() || !mailConfigured()) {
    console.error("[auth] missing CODE_SECRET or mail settings");
    return res.status(503).json({ ok: false, error: "not_configured", message: "שליחת מיילים עוד לא הוגדרה בשרת." });
  }
  if (!allowSend(email)) {
    res.setHeader("Retry-After", "3600");
    return res.status(429).json({ ok: false, error: "rate_limited", message: "נשלחו יותר מדי קודים לכתובת הזו. נסו שוב בעוד שעה." });
  }
  const ch = newChallenge(email);
  try {
    await sendMail(email, ch.code);
  } catch (err) {
    console.error("[auth] send failed:", err.message);
    return res.status(502).json({ ok: false, error: "send_failed", message: "שליחת המייל נכשלה. נסו שוב בעוד רגע." });
  }
  return res.status(200).json({ ok: true, token: ch.token, expiresInSec: ch.expiresInSec, codeLength: CODE_LENGTH });
}

module.exports = { issue, checkCode, cors, readBody, normEmail, validEmail, secret, newChallenge, CODE_LENGTH };
