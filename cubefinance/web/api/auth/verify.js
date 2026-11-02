// POST /api/auth/verify { email, code, token } → { ok: true } when the code is right.
const { checkCode, cors, readBody, normEmail, validEmail, secret } = require("../_lib");

const MESSAGES = {
  no_code: "לא נמצא קוד פעיל לכתובת הזו. בקשו קוד חדש.",
  expired: "הקוד פג תוקף. בקשו קוד חדש.",
  too_many_attempts: "יותר מדי ניסיונות שגויים. בקשו קוד חדש.",
  invalid: "הקוד שגוי. בדקו את הספרות ונסו שוב.",
};

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const body = readBody(req);
  const email = normEmail(body.email);
  if (!validEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email", message: "כתובת אימייל לא תקינה." });
  if (!secret()) return res.status(503).json({ ok: false, error: "not_configured", message: "האימות עוד לא הוגדר בשרת." });
  const r = checkCode(email, body.code, body.token);
  if (r.ok) return res.status(200).json({ ok: true, verified: true, message: "האימייל אומת בהצלחה." });
  return res.status(r.reason === "invalid" ? 400 : 410).json({
    ok: false, error: r.reason, message: MESSAGES[r.reason] || MESSAGES.invalid,
    attemptsLeft: r.attemptsLeft,
  });
};
