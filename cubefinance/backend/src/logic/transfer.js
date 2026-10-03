// ============================================================================
// Worker 3 — Backend & Core AI Logic
// transfer.js — simulated money movement from the "main account" into cubes.
//
// There is NO bank. The "main account" is just a pool of ILS the user chose to
// track. Transferring distributes that pool into cube balances proportionally to
// each cube's percentage. Fixed cubes (Housing) are funded first, up to their
// monthly contribution, then the remainder flows by percentage.
// ============================================================================

const round = (n) => Math.round(n * 100) / 100;

/**
 * @param {Array}  cubes            cubes from computeBudget (each has percentage, monthlyContribution, balance)
 * @param {number} amount           how much to move out of the main account pool
 * @param {Object} [opts]
 * @param {boolean} [opts.fundFixedFirst=true]  top up fixed cubes to their monthly target first
 * @returns {Object} { cubes, allocations, moved, mainAccountDelta }
 */
function simulateTransfer(cubes, amount, opts = {}) {
  const { fundFixedFirst = true } = opts;
  const pool = Math.max(0, Number(amount) || 0);
  if (pool === 0) {
    return { cubes, allocations: [], moved: 0, mainAccountDelta: 0 };
  }

  const working = cubes.map((c) => ({ ...c }));
  const allocations = [];
  let remaining = pool;

  // --- Phase 1: fund fixed cubes up to their monthly contribution ----------
  if (fundFixedFirst) {
    for (const cube of working) {
      if (!cube.fixed || remaining <= 0) continue;
      const need = Math.max(0, cube.monthlyContribution - cube.balance);
      const give = round(Math.min(need, remaining));
      if (give > 0) {
        cube.balance = round(cube.balance + give);
        remaining = round(remaining - give);
        allocations.push({ key: cube.key, name: cube.name, amount: give, phase: 'fixed' });
      }
    }
  }

  // --- Phase 2: distribute the remainder by percentage --------------------
  if (remaining > 0) {
    const flexible = working.filter((c) => (fundFixedFirst ? !c.fixed : true));
    const totalPct = flexible.reduce((s, c) => s + c.percentage, 0) || 1;

    let distributed = 0;
    flexible.forEach((cube, i) => {
      let give;
      if (i === flexible.length - 1) {
        give = round(remaining - distributed); // last cube absorbs rounding
      } else {
        give = round((cube.percentage / totalPct) * remaining);
      }
      distributed = round(distributed + give);
      cube.balance = round(cube.balance + give);
      const existing = allocations.find((a) => a.key === cube.key);
      if (existing) {
        existing.amount = round(existing.amount + give);
      } else {
        allocations.push({ key: cube.key, name: cube.name, amount: give, phase: 'percentage' });
      }
    });
  }

  const actuallyMoved = round(allocations.reduce((s, a) => s + a.amount, 0));

  return {
    cubes: working,
    allocations,
    moved: actuallyMoved,
    mainAccountDelta: -actuallyMoved,
  };
}

/**
 * Spend from a specific cube (used by the chatbot "can I afford X?" flow when
 * the user confirms a purchase). Returns updated cube + whether it went negative.
 */
function spendFromCube(cubes, key, amount) {
  const working = cubes.map((c) => ({ ...c }));
  const cube = working.find((c) => c.key === key);
  if (!cube) throw new Error(`Unknown cube: ${key}`);
  const spend = Math.max(0, Number(amount) || 0);
  cube.balance = round(cube.balance - spend);
  return { cubes: working, cube, overdrawn: cube.balance < 0 };
}

module.exports = { simulateTransfer, spendFromCube };
