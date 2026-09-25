// Minimal, dependency-free assertions for the core math (run: npm test).
const assert = require('assert');
const { computeBudget } = require('../src/logic/budgetEngine');
const { simulateTransfer } = require('../src/logic/transfer');

let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
};
const approx = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;

// --- Independent, 10,000 ILS example ---------------------------------------
const independent = computeBudget({
  age: 28,
  employed: true,
  monthlyIncome: 10000,
  livesWithParents: false,
  housing: { rent: 3500, arnona: 300, utilities: 400, houseCommittee: 100 },
});
ok(independent.cubes.some((c) => c.key === 'housing'), 'independent has a housing cube');
ok(approx(independent.summary.totalAllocated, 10000), 'independent allocations sum to income');
ok(
  independent.cubes.find((c) => c.key === 'housing').monthlyContribution === 4300,
  'housing cube equals sum of bills (4300)'
);

// --- With parents: no housing cube, wealth cubes boosted -------------------
const withParents = computeBudget({
  age: 28,
  employed: true,
  monthlyIncome: 10000,
  livesWithParents: true,
});
ok(!withParents.cubes.some((c) => c.key === 'housing'), 'with-parents has NO housing cube');
ok(approx(withParents.summary.totalAllocated, 10000), 'with-parents allocations sum to income');
const invIndep = independent.cubes.find((c) => c.key === 'investments').percentage;
const invParents = withParents.cubes.find((c) => c.key === 'investments').percentage;
ok(invParents > invIndep, 'investments % is boosted when living with parents');

// --- Age tilt: younger => more investments --------------------------------
const young = computeBudget({ age: 20, employed: true, monthlyIncome: 10000, livesWithParents: true });
const old = computeBudget({ age: 58, employed: true, monthlyIncome: 10000, livesWithParents: true });
ok(
  young.cubes.find((c) => c.key === 'investments').percentage >
    old.cubes.find((c) => c.key === 'investments').percentage,
  'younger user invests a larger share'
);

// --- Transfer simulation ---------------------------------------------------
const t = simulateTransfer(independent.cubes, 5000);
ok(approx(t.moved, 5000), 'transfer moves the full pool');
ok(
  approx(
    t.cubes.reduce((s, c) => s + c.balance, 0),
    5000
  ),
  'cube balances sum to the transferred amount'
);
ok(
  t.cubes.find((c) => c.key === 'housing').balance === 4300,
  'fixed housing cube funded first to its target'
);

console.log(`\n✅ All ${passed} budget/transfer assertions passed.`);
