// ============================================================================
// Worker 3 — Backend & Core AI Logic
// store.js — trivial in-memory session store keyed by userId.
//
// Deliberately not a database: CubeFinance holds only self-reported, simulated
// data and the mobile app is the source of truth. This server-side store just
// lets the AI endpoint stay stateless-per-request while remembering the last
// known snapshot for a session. Swap for Redis/Postgres in production.
// ============================================================================

const sessions = new Map();

function getSession(userId = 'default') {
  if (!sessions.has(userId)) {
    sessions.set(userId, { profile: null, budget: null, mainAccount: 0, chat: [] });
  }
  return sessions.get(userId);
}

function saveBudget(userId, profile, budget, mainAccount) {
  const s = getSession(userId);
  s.profile = profile;
  s.budget = budget;
  if (typeof mainAccount === 'number') s.mainAccount = mainAccount;
  return s;
}

function updateCubes(userId, cubes, mainAccount) {
  const s = getSession(userId);
  if (s.budget) s.budget.cubes = cubes;
  if (typeof mainAccount === 'number') s.mainAccount = mainAccount;
  return s;
}

function appendChat(userId, message) {
  const s = getSession(userId);
  s.chat.push(message);
  if (s.chat.length > 40) s.chat.splice(0, s.chat.length - 40);
  return s;
}

module.exports = { getSession, saveBudget, updateCubes, appendChat };
