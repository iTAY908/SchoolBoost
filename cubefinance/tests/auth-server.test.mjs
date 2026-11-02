// Server-side tests of the email-code flow: the real cf-auth function + the real SQL.
//   ./setup-db.sh && node --experimental-strip-types --no-warnings auth-server.test.mjs
import assert from "node:assert/strict";
import { callAuth, state, lastCode, sql } from "./fake-backend.mjs";

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; console.log("  ✗ " + name + "\n      " + e.message); }
}
const fresh = (n) => `user${n}.${Date.now()}@test.example`;
const ageSends = (email, s) => sql(`update public.cf_code_sends set at = at - interval '${s} seconds' where email = '${email}'`);
const codeRow = (email) => sql(`select count(*) from public.cf_codes where email = '${email}'`);

console.log("cf-auth: email codes");

await t("success: provider accepts → ok, accepted, server expiry and resend wait", async () => {
  state.scenario = "ok"; const e = fresh(1);
  const r = await callAuth({ action: "send", email: e });
  assert.equal(r.ok, true); assert.equal(r.accepted, true); assert.equal(r.expires_in, 600); assert.equal(r.resend_in, 30);
  assert.match(lastCode(e), /^\d{6}$/);
  // only a hash is stored — never the code
  const stored = sql(`select code_hash from public.cf_codes where email = '${e}'`);
  assert.notEqual(stored, lastCode(e)); assert.equal(stored.length, 64);
});

await t("success: right code verifies once, then it is used up (single use)", async () => {
  state.scenario = "ok"; const e = fresh(2);
  await callAuth({ action: "send", email: e });
  const code = lastCode(e);
  const v = await callAuth({ action: "verify", email: e, code, session: false });
  assert.deepEqual(v, { ok: true, verified: true });
  const again = await callAuth({ action: "verify", email: e, code, session: false });
  assert.equal(again.ok, false); assert.equal(again.error, "no_code");
});

for (const [scenario, reason, retryable] of [
  ["non_browser", "provider_auth", false], ["gmail", "provider_account", false],
  ["quota", "provider_rate_limited", true], ["outage", "provider_unavailable", true],
  ["network", "provider_unavailable", true], ["ok_but_weird", "provider_unavailable", true],
]) {
  await t(`provider ${scenario} → send_failed (${reason}), no code left, no countdown`, async () => {
    state.scenario = scenario; const e = fresh("f" + scenario);
    const r = await callAuth({ action: "send", email: e });
    assert.equal(r.ok, false); assert.equal(r.error, "send_failed"); assert.equal(r.reason, reason); assert.equal(r.retryable, retryable);
    assert.equal(r.expires_in, undefined);
    assert.equal(codeRow(e), "0", "the code must be withdrawn when the email was not accepted");
    // and the failed attempt does not eat into the resend limit
    state.scenario = "ok";
    const r2 = await callAuth({ action: "send", email: e });
    assert.equal(r2.ok, true, "a retry right after a provider failure must be allowed");
  });
}

await t("a failed resend withdraws the previous code too (no stale countdown)", async () => {
  state.scenario = "ok"; const e = fresh(3);
  await callAuth({ action: "send", email: e }); const first = lastCode(e);
  ageSends(e, 31); state.scenario = "outage";
  const r = await callAuth({ action: "send", email: e });
  assert.equal(r.ok, false);
  const v = await callAuth({ action: "verify", email: e, code: first, session: false });
  assert.equal(v.error, "no_code");
});

await t("wrong code: attempts left counts down, 5th wrong locks the code", async () => {
  state.scenario = "ok"; const e = fresh(4);
  await callAuth({ action: "send", email: e });
  const good = lastCode(e), bad = good === "000000" ? "111111" : "000000";
  const left = [];
  for (let i = 0; i < 5; i++) left.push((await callAuth({ action: "verify", email: e, code: bad, session: false })).attempts_left);
  assert.deepEqual(left, [4, 3, 2, 1, 0]);
  const locked = await callAuth({ action: "verify", email: e, code: good, session: false });
  assert.equal(locked.error, "too_many_attempts", "even the right code is refused after 5 wrong tries");
});

await t("expired code is refused with 'expired'", async () => {
  state.scenario = "ok"; const e = fresh(5);
  await callAuth({ action: "send", email: e });
  sql(`update public.cf_codes set expires_at = now() - interval '1 second' where email = '${e}'`);
  const v = await callAuth({ action: "verify", email: e, code: lastCode(e), session: false });
  assert.equal(v.ok, false); assert.equal(v.error, "expired");
});

await t("verify with no code ever sent → no_code (never 'expired')", async () => {
  const v = await callAuth({ action: "verify", email: fresh(6), code: "123456", session: false });
  assert.equal(v.error, "no_code");
});

await t("resend: too soon (<30 s) is refused with retry_after; after 30 s a new code replaces the old", async () => {
  state.scenario = "ok"; const e = fresh(7);
  await callAuth({ action: "send", email: e }); const first = lastCode(e);
  const soon = await callAuth({ action: "send", email: e });
  assert.equal(soon.error, "too_soon"); assert.ok(soon.retry_after > 0 && soon.retry_after <= 30);
  ageSends(e, 31);
  const again = await callAuth({ action: "send", email: e });
  assert.equal(again.ok, true);
  const second = lastCode(e);
  if (second !== first) {
    const old = await callAuth({ action: "verify", email: e, code: first, session: false });
    assert.equal(old.ok, false, "the previous code must stop working");
  }
  const ok = await callAuth({ action: "verify", email: e, code: second, session: false });
  assert.equal(ok.ok, true);
});

await t("duplicate requests at the same moment send at most one email", async () => {
  state.scenario = "ok"; const e = fresh(8); const before = state.mailed.length;
  const rs = await Promise.all([1, 2, 3, 4].map(() => callAuth({ action: "send", email: e })));
  assert.equal(rs.filter((r) => r.ok).length, 1, JSON.stringify(rs));
  assert.equal(state.mailed.length - before, 1);
});

await t("hourly limit: 7th code within an hour is refused with retry_after", async () => {
  state.scenario = "ok"; const e = fresh(9); let r;
  for (let i = 0; i < 6; i++) { r = await callAuth({ action: "send", email: e }); assert.equal(r.ok, true, "send " + (i + 1)); ageSends(e, 31); }
  r = await callAuth({ action: "send", email: e });
  assert.equal(r.error, "rate_limited"); assert.ok(r.retry_after > 0);
});

await t("bad input: invalid email, malformed code", async () => {
  assert.equal((await callAuth({ action: "send", email: "not-an-email" })).error, "bad_email");
  assert.equal((await callAuth({ action: "verify", email: fresh(10), code: "12", session: false })).error, "bad_code");
});

await t("no codes or secrets in the function's answers", async () => {
  state.scenario = "ok"; const e = fresh(11);
  const r = JSON.stringify(await callAuth({ action: "send", email: e }));
  assert.ok(!r.includes(lastCode(e)) && !r.includes("test-private-key"));
  state.scenario = "non_browser";
  const f = JSON.stringify(await callAuth({ action: "send", email: fresh(12) }));
  assert.ok(!f.includes("test-private-key"));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
