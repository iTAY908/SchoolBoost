// POST /api/auth/resend { email } → a fresh code; the old token keeps working
// until it expires, but only the newest email is what the user will type.
module.exports = require("../_lib").issue;
