// ============================================================================
// Worker 5 — Integration (backend half)
// state.js — /api/state  persist & load the full app snapshot per user.
//
// This is what makes the client's data survive across devices and reinstalls:
// the mobile app / web preview pushes its snapshot here and pulls it back on
// launch, reconciling by savedAt (last write wins). No bank data — just the
// user's own self-reported cubes, profile and chat.
// ============================================================================

const express = require('express');
const { saveState, getState } = require('../data/store');

const router = express.Router();

const MAX_BYTES = 512 * 1024; // guard against oversized blobs

/** GET /api/state?userId= -> { state, savedAt } */
router.get('/', (req, res) => {
  const userId = String(req.query.userId || 'default');
  res.json(getState(userId));
});

/** PUT /api/state  body: { userId, state, savedAt? } -> { ok, savedAt } */
router.put('/', (req, res) => {
  const { userId = 'default', state, savedAt } = req.body || {};
  if (state == null || typeof state !== 'object') {
    return res.status(400).json({ error: 'state object is required' });
  }
  if (JSON.stringify(state).length > MAX_BYTES) {
    return res.status(413).json({ error: 'state too large' });
  }
  const saved = saveState(String(userId), state, savedAt);
  res.json({ ok: true, savedAt: saved.savedAt });
});

module.exports = router;
