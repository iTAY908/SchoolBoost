// ============================================================================
// Email delivery for verification codes — pluggable transport.
//
//   MAIL_TRANSPORT=console   (default in dev) prints the code to the server log
//   MAIL_TRANSPORT=composio  sends via Composio (Gmail or Loops toolkit)
//   MAIL_TRANSPORT=smtp      sends via any SMTP provider through nodemailer
//
// A note on choosing: Composio is an automation layer that brokers a connected
// account (Gmail/Loops). It works, and it is handy if you already run Composio,
// but for a signup path it adds a network hop and a third party to an already
// latency-sensitive request. A dedicated transactional provider (SMTP, Resend,
// SendGrid, Loops direct) is the conventional choice for volume and
// deliverability. Both are wired up here — pick per environment.
// ============================================================================

const config = require('../config');

const FROM = process.env.MAIL_FROM || 'CubeFinance <no-reply@cubefinance.app>';
const TRANSPORT = (process.env.MAIL_TRANSPORT || 'console').toLowerCase();

// ---------------------------------------------------------------------------
// Message body
// ---------------------------------------------------------------------------
function buildMessage(code) {
  const subject = `קוד האימות שלך: ${code}`;
  const text =
    `קוד האימות שלך ל-CubeFinance הוא: ${code}\n\n` +
    `הקוד תקף ל-10 דקות ומיועד לשימוש חד-פעמי.\n` +
    `אם לא ביקשת את הקוד הזה — אפשר להתעלם מהמייל, לא בוצע שום שינוי בחשבון.`;
  const html = `
<div dir="rtl" style="font-family:Segoe UI,Arial,'Noto Sans Hebrew',sans-serif;background:#f4f6fc;padding:28px">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e2e6f3">
    <div style="font-size:22px;font-weight:800;color:#171a2b">🧊 CubeFinance</div>
    <p style="color:#5c6280;font-size:15px;line-height:1.7;margin:18px 0 8px">
      זה קוד האימות שלך. הוא תקף ל-<b>10 דקות</b> ולשימוש חד-פעמי:
    </p>
    <div style="font-size:38px;font-weight:900;letter-spacing:12px;color:#4f5dff;
                text-align:center;padding:18px;background:#f2f4ff;border-radius:14px;direction:ltr">
      ${code}
    </div>
    <p style="color:#8a90ab;font-size:12.5px;line-height:1.7;margin-top:20px">
      לא ביקשת את הקוד? אפשר להתעלם מהמייל — לא בוצע שום שינוי בחשבון,
      ואף אחד לא יכול להיכנס בלי הקוד הזה.
    </p>
  </div>
</div>`;
  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

/** Dev: never sends anything, just logs. Keeps local work friction-free. */
async function sendViaConsole(to, code) {
  const { subject } = buildMessage(code);
  console.log(`\n📧 [dev mailer] → ${to}\n   ${subject}\n   CODE: ${code}\n`);
  return { ok: true, transport: 'console', devCode: code };
}

/**
 * Composio — sends through YOUR connected Gmail account (or Loops).
 * Requires COMPOSIO_API_KEY plus a connected account for the toolkit.
 * Uses the official SDK rather than hand-rolled REST so the call shape stays
 * correct across API versions. Docs: https://docs.composio.dev
 */
let composioClient = null;
async function sendViaComposio(to, code) {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error('COMPOSIO_API_KEY is not set');

  let Composio;
  try {
    ({ Composio } = require('@composio/core'));
  } catch {
    throw new Error('MAIL_TRANSPORT=composio requires the SDK — run: npm i @composio/core');
  }
  if (!composioClient) composioClient = new Composio({ apiKey });

  const { subject, html, text } = buildMessage(code);
  const toolkit = (process.env.COMPOSIO_MAIL_TOOL || 'gmail').toLowerCase();
  const userId = process.env.COMPOSIO_USER_ID || 'default';

  if (toolkit === 'loops') {
    // Fires an event that triggers a published transactional template; the code
    // is passed through as an event property the template renders.
    await composioClient.tools.execute('LOOPS_SO_SEND_EVENT', {
      userId,
      arguments: {
        email: to,
        eventName: process.env.LOOPS_EVENT_NAME || 'verification_code',
        eventProperties: { code },
        idempotencyKey: `verify-${to}-${code}-${Math.floor(Date.now() / 60000)}`,
      },
    });
  } else {
    // Sends straight from the connected Gmail mailbox.
    await composioClient.tools.execute('GMAIL_SEND_EMAIL', {
      userId,
      arguments: {
        recipient_email: to,
        subject,
        body: html || text,
        is_html: true,
      },
    });
  }
  return { ok: true, transport: `composio:${toolkit}` };
}

/** SMTP via nodemailer — works with Gmail, Resend, SendGrid, Mailgun, … */
async function sendViaSmtp(to, code) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    throw new Error("MAIL_TRANSPORT=smtp requires nodemailer — run: npm i nodemailer");
  }
  const { subject, text, html } = buildMessage(code);
  const opts = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
  };
  // Only send credentials when they exist. Passing an auth block with undefined
  // values makes nodemailer attempt PLAIN auth and fail against relays that
  // don't require login (local MTAs, internal smarthosts).
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    opts.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  }
  const transporter = nodemailer.createTransport(opts);
  await transporter.sendMail({ from: FROM, to, subject, text, html });
  return { ok: true, transport: 'smtp' };
}

/**
 * Send a verification code.
 * Never throws at the caller — a mail failure must not leak account existence
 * or crash the request; it is logged and reported as a generic failure.
 */
async function sendVerificationCode(to, code) {
  try {
    if (TRANSPORT === 'composio') return await sendViaComposio(to, code);
    if (TRANSPORT === 'smtp') return await sendViaSmtp(to, code);
    return await sendViaConsole(to, code);
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
    return { ok: false, transport: TRANSPORT, error: 'send_failed' };
  }
}

module.exports = { sendVerificationCode, buildMessage, TRANSPORT };
