// ============================================================================
// Worker 3 — Backend & Core AI Logic
// budgetEngine.js — deterministic budgeting math (the "brain" of the cubes)
//
// This module is pure and side-effect free so it is trivially testable and can
// run identically on the server or (if ever needed) on the client. The AI layer
// narrates ON TOP of this math — it never replaces it.
// ============================================================================

/**
 * Cube catalogue. Order matters for display. `key` is stable, used everywhere.
 * Colors are the canonical cube palette shared with the frontend theme.
 */
const CUBE_META = {
  housing: { name: 'Housing & Bills', color: '#6C5CE7', icon: 'home' },
  essentials: { name: 'Essentials', color: '#00B894', icon: 'cart' },
  savings: { name: 'Savings', color: '#0984E3', icon: 'piggy-bank' },
  investments: { name: 'Investments', color: '#E17055', icon: 'trending-up' },
  emergency: { name: 'Emergency Fund', color: '#D63031', icon: 'shield' },
  lifestyle: { name: 'Lifestyle', color: '#FDCB6E', icon: 'sparkles' },
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const round = (n) => Math.round(n * 100) / 100;

/**
 * Age tilt: younger investors get a longer time horizon, so a larger slice
 * flows to Investments; older users lean toward Savings + Emergency stability.
 * Returns multipliers applied to the discretionary (non-housing) split.
 */
function ageTilt(age) {
  const a = clamp(Number(age) || 30, 16, 90);
  // 0 at age 60+, 1 at age 20 or younger — linear aggressiveness factor.
  const aggressiveness = clamp((60 - a) / 40, 0, 1);
  return {
    investments: 0.7 + aggressiveness * 0.8, // 0.7x .. 1.5x
    savings: 1.3 - aggressiveness * 0.4, // 1.3x .. 0.9x
    emergency: 1.2 - aggressiveness * 0.3, // 1.2x .. 0.9x
    lifestyle: 0.9 + aggressiveness * 0.2, // 0.9x .. 1.1x
    essentials: 1.0,
  };
}

/**
 * Normalize a weight map so its values sum to `target` (a fraction of income).
 */
function normalizeToShare(weights, targetShare) {
  const total = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
  const out = {};
  for (const [k, w] of Object.entries(weights)) {
    out[k] = (w / total) * targetShare;
  }
  return out;
}

/**
 * Core budget computation.
 *
 * @param {Object} profile
 * @param {number} profile.age
 * @param {boolean} profile.employed
 * @param {number}  profile.monthlyIncome
 * @param {boolean} profile.livesWithParents
 * @param {Object}  [profile.housing] { rent, arnona, utilities, houseCommittee }
 * @returns {Object} budget breakdown
 */
function computeBudget(profile) {
  const income = Math.max(0, Number(profile.monthlyIncome) || 0);
  const independent = !profile.livesWithParents;
  const tilt = ageTilt(profile.age);

  // --- 1. Fixed housing cost (only when independent) ------------------------
  const h = profile.housing || {};
  const housingCost = independent
    ? round(
        (Number(h.rent) || 0) +
          (Number(h.arnona) || 0) +
          (Number(h.utilities) || 0) +
          (Number(h.houseCommittee) || 0)
      )
    : 0;

  const housingShare = income > 0 ? clamp(housingCost / income, 0, 0.85) : 0;
  const discretionaryShare = 1 - housingShare;

  // --- 2. Discretionary weights --------------------------------------------
  // Base weights differ by living situation. When living with parents, the
  // "would-be housing" money is redistributed into savings/investments/lifestyle.
  let weights;
  if (independent) {
    weights = {
      essentials: 0.32 * tilt.essentials,
      savings: 0.24 * tilt.savings,
      investments: 0.18 * tilt.investments,
      emergency: 0.12 * tilt.emergency,
      lifestyle: 0.14 * tilt.lifestyle,
    };
  } else {
    // No housing cube. Redistribute that freed capacity toward wealth-building.
    weights = {
      essentials: 0.22 * tilt.essentials,
      savings: 0.3 * tilt.savings,
      investments: 0.26 * tilt.investments,
      emergency: 0.1 * tilt.emergency,
      lifestyle: 0.12 * tilt.lifestyle,
    };
  }

  const shares = normalizeToShare(weights, discretionaryShare);

  // --- 3. Build cubes -------------------------------------------------------
  const cubes = [];

  if (independent && housingCost > 0) {
    cubes.push(buildCube('housing', housingShare, income, {
      note: 'Fixed monthly obligations',
      math: describeHousing(h),
      fixed: true,
    }));
  }

  const order = ['essentials', 'savings', 'investments', 'emergency', 'lifestyle'];
  for (const key of order) {
    const share = shares[key];
    cubes.push(
      buildCube(key, share, income, {
        note: cubeNote(key, independent),
        math: `${(share * 100).toFixed(1)}% of ${income.toLocaleString()} ILS`,
      })
    );
  }

  // --- 4. Reconcile rounding so cube amounts sum exactly to income ----------
  reconcile(cubes, income);

  return {
    income,
    currency: 'ILS',
    situation: independent ? 'independent' : 'with_parents',
    housingCost,
    cubes,
    summary: buildSummary(cubes, income, independent),
    generatedAt: new Date().toISOString(),
  };
}

function buildCube(key, share, income, extra = {}) {
  const meta = CUBE_META[key];
  const monthlyContribution = round(share * income);
  return {
    key,
    name: meta.name,
    color: meta.color,
    icon: meta.icon,
    percentage: round(share * 100),
    monthlyContribution,
    balance: 0, // filled by the transfer simulation
    fixed: false,
    ...extra,
  };
}

function describeHousing(h) {
  const parts = [
    ['Rent', h.rent],
    ['Arnona', h.arnona],
    ['Utilities', h.utilities],
    ['House committee', h.houseCommittee],
  ]
    .filter(([, v]) => Number(v) > 0)
    .map(([label, v]) => `${label} ${Number(v).toLocaleString()}`);
  return parts.length ? parts.join(' + ') + ' ILS' : 'No housing costs entered';
}

function cubeNote(key, independent) {
  const notes = {
    essentials: 'Food, transport, phone, day-to-day',
    savings: independent ? 'Short-term goals & buffer' : 'Boosted — no rent to pay',
    investments: independent ? 'Long-term wealth' : 'Boosted — put youth to work',
    emergency: 'Rainy-day fund (aim: 3–6 months)',
    lifestyle: independent ? 'Fun, dining, subscriptions' : 'Boosted — enjoy responsibly',
  };
  return notes[key];
}

/** Distribute the rounding remainder into the largest flexible cube. */
function reconcile(cubes, income) {
  const sum = cubes.reduce((s, c) => s + c.monthlyContribution, 0);
  const diff = round(income - sum);
  if (Math.abs(diff) < 0.01) return;
  const flexible = cubes.filter((c) => !c.fixed);
  const target = flexible.sort((a, b) => b.monthlyContribution - a.monthlyContribution)[0];
  if (target) {
    target.monthlyContribution = round(target.monthlyContribution + diff);
    target.percentage = income > 0 ? round((target.monthlyContribution / income) * 100) : 0;
  }
}

function buildSummary(cubes, income, independent) {
  const line = cubes
    .map((c) => `${c.name}: ${c.monthlyContribution.toLocaleString()} ILS (${c.percentage}%)`)
    .join(' · ');
  return {
    headline: independent
      ? 'Independent plan — a dedicated Housing cube covers your fixed bills.'
      : 'Living-with-parents plan — housing savings redirected into wealth-building cubes.',
    breakdown: line,
    totalAllocated: round(cubes.reduce((s, c) => s + c.monthlyContribution, 0)),
    income,
  };
}

module.exports = { computeBudget, CUBE_META };
