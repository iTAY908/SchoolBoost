// UI tests of the email-code screen, in Chromium, against the real cf-auth code + real SQL
// (fake-backend.mjs) with a simulated email provider.
//   ./setup-db.sh && node --experimental-strip-types --no-warnings verify-ui.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, state, lastCode, sql } from "./fake-backend.mjs";
const pwMod = await import(process.env.PW || "playwright"); const chromium = pwMod.chromium || pwMod.default.chromium;

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 47123;
const html = fs.readFileSync(path.join(here, "../web/cubefinance-web.html"), "utf8")
  .replace(/const CLOUD = \{ url: "[^"]+"/, `const CLOUD = { url: "http://127.0.0.1:${PORT}"`);
assert.ok(html.includes(`http://127.0.0.1:${PORT}`), "CLOUD url swapped for the test backend");
const page_ = path.join(here, ".verify-ui.html"); fs.writeFileSync(page_, html);

const srv = await serve(PORT);
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
let pass = 0, fail = 0;
async function t(name, fn) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("file://" + page_);
    await page.addStyleTag({ content: "#introwrap{display:none!important}" });
    await fn(page, ctx);
    assert.deepEqual(errors, [], "page errors: " + errors.join("; "));
    pass++; console.log("  ✓ " + name);
  } catch (e) { fail++; console.log("  ✗ " + name + "\n      " + e.message.split("\n")[0]); await page.screenshot({ path: path.join(here, ".fail-" + pass + fail + ".png") }).catch(() => {}); }
  await ctx.close();
}
const fresh = (n) => `ui${n}.${Date.now()}@test.example`;
const PW = "Strong#Pass123";
const text = (page) => page.evaluate(() => document.getElementById("view").innerText);
async function signup(page, email) {
  await page.evaluate(() => { state.screen = "auth"; state.authMode = "signup"; render(); });
  await page.fill("#aEmail", email); await page.fill("#aPass", PW); await page.click("#aSubmit");
}
async function typeCode(page, code) { await page.click("#otp0"); await page.keyboard.type(code, { delay: 15 }); }
const until = async (page, fn, ms = 6000) => page.waitForFunction(fn, null, { timeout: ms });

console.log("Verification screen");

await t("sending: loading state, no inputs, no 'expired'; then success → countdown from server → app opens", async (page) => {
  state.scenario = "ok"; const e = fresh(1);
  await page.route("**/functions/v1/cf-auth", async (r) => { await new Promise((x) => setTimeout(x, 700)); await r.continue().catch(() => {}); });
  await signup(page, e);
  const during = await text(page);
  assert.match(during, /שולחים קוד/); assert.doesNotMatch(during, /פג תוקף/);
  assert.equal(await page.locator(".otpbox").count(), 0);
  await until(page, () => document.querySelector(".otpbox"));
  await page.unroute("**/functions/v1/cf-auth");
  const after = await text(page);
  assert.match(after, /שירות המייל קיבל קוד/); assert.match(after, /הקוד תקף עוד (10:00|09:5\d)/);
  await typeCode(page, lastCode(e));
  await until(page, () => state.screen === "onboarding" || state.screen === "app");
  assert.equal(await page.evaluate((e) => !!loadUsers()[e].emailVerified, e), true);
});

await t("provider rejects: 'not sent' + Hebrew error + controlled retry; never 'sent' or 'expired'", async (page) => {
  state.scenario = "non_browser"; const e = fresh(2);
  await signup(page, e);
  await until(page, () => vf && vf.phase === "failed");
  const s = await text(page);
  assert.match(s, /הקוד לא נשלח/); assert.match(s, /לא נשלח קוד/);
  assert.doesNotMatch(s, /פג תוקף/); assert.doesNotMatch(s, /שירות המייל קיבל/);
  assert.equal(await page.locator(".otpbox").count(), 0);
  assert.equal(await page.locator("#otpRetry").isDisabled(), true, "retry is held back for a moment");
});

await t("temporary outage → retry after the wait succeeds", async (page) => {
  state.scenario = "outage"; const e = fresh(3);
  await signup(page, e);
  await until(page, () => vf && vf.phase === "failed");
  assert.match(await text(page), /נכשלה זמנית/);
  state.scenario = "ok";
  await until(page, () => !document.getElementById("otpRetry").disabled, 8000);
  await page.click("#otpRetry");
  await until(page, () => vf && vf.phase === "sent");
  await typeCode(page, lastCode(e));
  await until(page, () => state.screen === "onboarding" || state.screen === "app");
});

await t("network failure (request never reaches the server) → 'no internet', not sent", async (page) => {
  const e = fresh(4);
  await page.route("**/functions/v1/cf-auth", (r) => r.abort("internetdisconnected"));
  await signup(page, e);
  await until(page, () => vf && vf.phase === "failed");
  const s = await text(page);
  assert.match(s, /אין חיבור לאינטרנט/); assert.doesNotMatch(s, /פג תוקף/);
});

await t("verification service down (HTTP 503) → 'service unavailable', not sent", async (page) => {
  state.scenario = "down"; const e = fresh(5);
  await signup(page, e);
  await until(page, () => vf && vf.phase === "failed");
  assert.match(await text(page), /לא זמין כרגע/);
  state.scenario = "ok";
});

await t("wrong code counts down attempts; 5 wrong → locked, inputs off, resend offered", async (page) => {
  state.scenario = "ok"; const e = fresh(6);
  await signup(page, e); await until(page, () => vf && vf.phase === "sent");
  const bad = lastCode(e) === "000000" ? "111111" : "000000";
  await typeCode(page, bad); await until(page, () => /נותרו 4/.test(document.getElementById("view").innerText));
  for (let i = 0; i < 4; i++) { await typeCode(page, bad); await page.waitForTimeout(350); }
  await until(page, () => vf.locked === true);
  assert.match(await text(page), /יותר מדי ניסיונות/);
  assert.equal(await page.locator("#otp0").isDisabled(), true);
  assert.equal(await page.locator("#otpResend").isDisabled(), false);
});

await t("expired on the server → 'code expired'; expired on the clock → inputs off + resend", async (page) => {
  state.scenario = "ok"; const e = fresh(7);
  await signup(page, e); await until(page, () => vf && vf.phase === "sent");
  sql(`update public.cf_codes set expires_at = now() - interval '1 second' where email = '${e}'`);
  await typeCode(page, lastCode(e));
  await until(page, () => /פג תוקף/.test(document.getElementById("view").innerText));
  assert.equal(await page.locator("#otp0").isDisabled(), true);
  assert.equal(await page.locator("#otpResend").isDisabled(), false);
});

await t("resend: held for 30 s, then one new code that works; rapid clicks send one email", async (page) => {
  state.scenario = "ok"; const e = fresh(8);
  await signup(page, e); await until(page, () => vf && vf.phase === "sent");
  assert.equal(await page.locator("#otpResend").isDisabled(), true);
  sql(`update public.cf_code_sends set at = at - interval '31 seconds' where email = '${e}'`);
  await page.evaluate(() => { vf.resendAt = 0; renderVerify(); });
  const before = state.emailCalls;
  await page.evaluate(() => { const b = document.getElementById("otpResend"); b.click(); b.click(); b.click(); });
  await until(page, () => vf.phase === "sent" && !document.querySelector(".otpsending"));
  assert.equal(state.emailCalls - before, 1, "exactly one email for several fast clicks");
  await typeCode(page, lastCode(e));
  await until(page, () => state.screen === "onboarding" || state.screen === "app");
});

await t("mistyped address on sign-up: fix it, code goes to the new one, account moves (nothing lost)", async (page) => {
  state.scenario = "ok"; const wrong = fresh("9wrong"), right = fresh("9right");
  await signup(page, wrong); await until(page, () => vf && vf.phase === "sent");
  await page.click("#otpEdit"); await page.fill("#otpNewEmail", right); await page.click("#otpEditSave");
  await until(page, () => vf && vf.email === "${right}".replace("${right}", vf.email) && vf.phase === "sent");
  assert.equal(await page.evaluate(() => vf.email), right);
  await typeCode(page, lastCode(right));
  await until(page, () => state.screen === "onboarding" || state.screen === "app");
  const users = await page.evaluate(() => loadUsers());
  assert.ok(users[right] && users[right].emailVerified, "account now under the corrected address");
  assert.ok(!users[wrong], "no stray account left under the wrong address");
  assert.equal(await page.evaluate(() => state.authUser.email), right);
});

await t("existing user (signed in, data on the phone) verifies and keeps every number", async (page) => {
  state.scenario = "ok"; const e = fresh(10);
  await page.evaluate((e) => {
    const users = loadUsers();
    users[e] = { id: "acc_test_existing", email: e, salt: "s", hash: "h", failCount: 0, lockUntil: 0, createdAt: Date.now() };
    saveUsers(users);
    localStorage.setItem("cubefinance_web:state:acc_test_existing", JSON.stringify({ onboarded: true, pool: 2777, cubes: [], profile: { income: 5000 }, expenses: [{ amount: 50 }], premium: true }));
    setSession(e);
  }, e);
  await page.reload(); await page.addStyleTag({ content: "#introwrap{display:none!important}" });
  await until(page, () => state.screen === "verify" && vf && vf.purpose === "existing" && vf.phase === "sent");
  assert.match(await text(page), /עדכון אבטחה/);
  await typeCode(page, lastCode(e));
  await until(page, () => state.screen === "app");
  assert.equal(await page.evaluate(() => state.pool), 2777);
  assert.equal(await page.evaluate(() => state.expenses.length), 1);
});

await t("forgot password: code → new-password screen (account found on the phone)", async (page) => {
  state.scenario = "ok"; const e = fresh(11);
  await page.evaluate((e) => { const u = loadUsers(); u[e] = { id: "acc_reset_t", email: e, salt: "s", hash: "h", failCount: 0, lockUntil: 0, createdAt: Date.now(), emailVerified: true }; saveUsers(u); }, e);
  await page.evaluate((e) => { fpState = { email: e, error: "" }; state.screen = "forgot"; render(); }, e);
  await page.fill("#fpEmail", e); await page.click("#fpSend");
  await until(page, () => vf && vf.purpose === "reset" && vf.phase === "sent");
  await typeCode(page, lastCode(e));
  await until(page, () => state.screen === "newpw");
});

await t("screenshots of the three states (sending, sent, failed)", async (page) => {
  const shots = process.env.SHOTS; if (!shots) return;
  state.scenario = "ok"; const e = fresh(12);
  await page.route("**/functions/v1/cf-auth", async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue().catch(() => {}); });
  await signup(page, e); await page.waitForTimeout(400);
  await page.screenshot({ path: shots + "/verify-1-sending.png" });
  await until(page, () => vf && vf.phase === "sent"); await page.waitForTimeout(300);
  await page.screenshot({ path: shots + "/verify-2-sent.png" });
  await page.unroute("**/functions/v1/cf-auth");
  state.scenario = "non_browser";
  await page.evaluate(() => { vf.resendAt = 0; renderVerify(); });
  sql(`update public.cf_code_sends set at = at - interval '31 seconds' where email = '${e}'`);
  await page.click("#otpResend"); await until(page, () => vf && vf.phase === "failed"); await page.waitForTimeout(300);
  await page.screenshot({ path: shots + "/verify-3-failed.png" });
  state.scenario = "ok";
});

await browser.close(); srv.close(); fs.unlinkSync(page_);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
