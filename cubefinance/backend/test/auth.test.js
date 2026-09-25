// ============================================================================
// Verification-flow tests. Run: node test/auth.test.js
// Focused on the security properties, not just the happy path.
// ============================================================================

const assert = require('assert');
const {
  generateCode, createChallenge, verifyChallenge,
  isValidEmail, normaliseEmail, MAX_ATTEMPTS, TTL_MS,
} = require('../src/auth/otp');
const limiter = require('../src/auth/rateLimit');

let passed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('\nCode generation');
test('always 4 digits, zero-padded', () => {
  for (let i = 0; i < 5000; i++) {
    const c = generateCode();
    assert.match(c, /^\d{4}$/, `bad code: ${c}`);
  }
});
test('is random — 5000 draws produce many distinct values', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(generateCode());
  assert.ok(seen.size > 3000, `only ${seen.size} distinct values — not random enough`);
});
test('covers the whole 0000–9999 range (leading zeros possible)', () => {
  let sawLeadingZero = false;
  for (let i = 0; i < 20000 && !sawLeadingZero; i++) {
    if (generateCode().startsWith('0')) sawLeadingZero = true;
  }
  assert.ok(sawLeadingZero, 'never generated a code starting with 0');
});
test('consecutive codes differ (new code every send)', () => {
  let same = 0;
  for (let i = 0; i < 500; i++) if (generateCode() === generateCode()) same++;
  assert.ok(same < 20, `too many repeats: ${same}/500`);
});

console.log('\nStorage');
test('plaintext code is never stored', () => {
  const { code, record } = createChallenge('a@b.com');
  const blob = JSON.stringify(record);
  assert.ok(!blob.includes(code), 'the record contains the plaintext code!');
  assert.ok(record.codeHash && record.salt, 'missing hash/salt');
});
test('same code hashes differently per challenge (unique salt)', () => {
  const a = createChallenge('a@b.com');
  const b = createChallenge('a@b.com');
  if (a.code === b.code) assert.notStrictEqual(a.record.codeHash, b.record.codeHash);
  assert.notStrictEqual(a.record.salt, b.record.salt);
});

console.log('\nVerification');
test('correct code passes', () => {
  const { code, record } = createChallenge('a@b.com');
  assert.deepStrictEqual(verifyChallenge(record, code), { ok: true });
});
test('wrong code fails and burns an attempt', () => {
  const { code, record } = createChallenge('a@b.com');
  const wrong = String((Number(code) + 1) % 10000).padStart(4, '0');
  const r = verifyChallenge(record, wrong);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid');
  assert.strictEqual(record.attempts, 1);
});
test('a correct code cannot be replayed', () => {
  const { code, record } = createChallenge('a@b.com');
  assert.strictEqual(verifyChallenge(record, code).ok, true);
  const again = verifyChallenge(record, code);
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.reason, 'already_used');
});
test('expired code is rejected even when correct', () => {
  const { code, record } = createChallenge('a@b.com');
  record.expiresAt = Date.now() - 1;
  const r = verifyChallenge(record, code);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'expired');
});
test('expiry window is 10 minutes', () => {
  const { record } = createChallenge('a@b.com');
  assert.strictEqual(record.expiresAt - record.createdAt, TTL_MS);
  assert.strictEqual(TTL_MS, 10 * 60 * 1000);
});
test(`brute force dies after ${MAX_ATTEMPTS} attempts — even if the next guess is right`, () => {
  const { code, record } = createChallenge('a@b.com');
  for (let i = 0; i < MAX_ATTEMPTS; i++) verifyChallenge(record, '0000' === code ? '1111' : '0000');
  const r = verifyChallenge(record, code); // the RIGHT code, but too late
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'too_many_attempts');
});
test('malformed input is rejected without crashing', () => {
  const { record } = createChallenge('a@b.com');
  for (const bad of [null, undefined, '', 'abcd', '12', '123456', '<script>', {}, []]) {
    const r = verifyChallenge(record, bad);
    assert.strictEqual(r.ok, false);
  }
});
test('missing record is handled', () => {
  assert.strictEqual(verifyChallenge(null, '1234').reason, 'no_code');
});

console.log('\nEmail handling');
test('valid addresses accepted, junk rejected', () => {
  ['a@b.co', 'user.name+tag@example.com'].forEach((e) => assert.ok(isValidEmail(e), e));
  ['', 'a@b', 'no-at.com', 'a b@c.com', 'a@@b.com'].forEach((e) => assert.ok(!isValidEmail(e), e));
});
test('addresses are normalised (case/space insensitive)', () => {
  assert.strictEqual(normaliseEmail('  User@Example.COM '), 'user@example.com');
});

console.log('\nRate limiting');
test('email send limit trips after 5 in the window', () => {
  const id = 'limit-test-' + Date.now();
  for (let i = 0; i < 5; i++) assert.ok(limiter.hit('sendPerEmail', id).allowed, `send ${i + 1} should pass`);
  const sixth = limiter.hit('sendPerEmail', id);
  assert.strictEqual(sixth.allowed, false);
  assert.ok(sixth.retryAfterSec > 0, 'should report a retry-after');
});
test('buckets are independent per identity', () => {
  const a = 'ind-a-' + Date.now(), b = 'ind-b-' + Date.now();
  for (let i = 0; i < 5; i++) limiter.hit('sendPerEmail', a);
  assert.strictEqual(limiter.hit('sendPerEmail', a).allowed, false);
  assert.strictEqual(limiter.hit('sendPerEmail', b).allowed, true, 'b must not be affected by a');
});
test('reset clears a bucket after successful verification', () => {
  const id = 'reset-' + Date.now();
  for (let i = 0; i < 6; i++) limiter.hit('sendPerEmail', id);
  assert.strictEqual(limiter.peek('sendPerEmail', id).allowed, false);
  limiter.reset('sendPerEmail', id);
  assert.strictEqual(limiter.peek('sendPerEmail', id).allowed, true);
});

console.log(`\n${passed} checks passed\n`);
