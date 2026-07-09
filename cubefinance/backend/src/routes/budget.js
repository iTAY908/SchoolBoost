// ============================================================================
// Worker 3 — Backend & Core AI Logic  (routes)
// budget.js — /api/budget/calculate  and  /api/budget/transfer
// ============================================================================

const express = require('express');
const { computeBudget } = require('../logic/budgetEngine');
const { simulateTransfer, spendFromCube } = require('../logic/transfer');
const { evaluateAlerts } = require('../logic/alerts');
const { saveBudget, updateCubes, getSession } = require('../data/store');

const router = express.Router();

/**
 * POST /api/budget/calculate
 * body: { userId?, profile }
 * -> full budget breakdown (cubes, percentages, math, summary)
 */
router.post('/calculate', (req, res) => {
  const { userId = 'default', profile } = req.body || {};
  if (!profile || typeof profile !== 'object') {
    return res.status(400).json({ error: 'profile is required' });
  }
  if (profile.employed && !(Number(profile.monthlyIncome) > 0)) {
    return res
      .status(400)
      .json({ error: 'monthlyIncome is required when employed is true' });
  }

  const budget = computeBudget(profile);
  saveBudget(userId, profile, budget, Number(profile.initialBalance) || 0);
  res.json({ budget, mainAccount: Number(profile.initialBalance) || 0 });
});

/**
 * POST /api/budget/transfer
 * body: { userId?, cubes, amount, fundFixedFirst? }
 * -> updated cubes + per-cube allocations for the animation
 */
router.post('/transfer', (req, res) => {
  const { userId = 'default', cubes, amount, fundFixedFirst } = req.body || {};
  if (!Array.isArray(cubes)) {
    return res.status(400).json({ error: 'cubes array is required' });
  }
  const result = simulateTransfer(cubes, amount, { fundFixedFirst });
  const session = getSession(userId);
  const newMain = Math.max(0, (session.mainAccount || 0) + result.mainAccountDelta);
  updateCubes(userId, result.cubes, newMain);

  res.json({
    cubes: result.cubes,
    allocations: result.allocations,
    moved: result.moved,
    mainAccount: newMain,
    alerts: evaluateAlerts(result.cubes),
  });
});

/**
 * POST /api/budget/spend
 * body: { userId?, cubes, key, amount }
 * -> spend from a specific cube (used after chatbot confirms a purchase)
 */
router.post('/spend', (req, res) => {
  const { userId = 'default', cubes, key, amount } = req.body || {};
  if (!Array.isArray(cubes) || !key) {
    return res.status(400).json({ error: 'cubes array and key are required' });
  }
  try {
    const result = spendFromCube(cubes, key, amount);
    updateCubes(userId, result.cubes);
    res.json({
      cubes: result.cubes,
      overdrawn: result.overdrawn,
      alerts: evaluateAlerts(result.cubes),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** GET /api/budget/alerts?userId= -> real-time monitoring snapshot */
router.get('/alerts', (req, res) => {
  const session = getSession(req.query.userId || 'default');
  res.json({ alerts: evaluateAlerts(session.budget?.cubes || []) });
});

module.exports = router;
