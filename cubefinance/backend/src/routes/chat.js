// ============================================================================
// Worker 4 — Floating AI Financial Buddy  (backend)
// chat.js — /api/chat  (Server-Sent Events streaming) and /api/chat/sync
// ============================================================================

const express = require('express');
const { streamChat, isLive } = require('../services/aiClient');
const { evaluateAlerts } = require('../logic/alerts');
const { appendChat, getSession } = require('../data/store');

const router = express.Router();

/**
 * POST /api/chat  — streams the buddy's reply as SSE.
 * body: { userId?, messages:[{role,content}], context:{ profile, cubes, mainAccount } }
 *
 * Events:
 *   data: {"type":"delta","text":"..."}
 *   data: {"type":"done","full":"...","alerts":[...]}
 *   data: {"type":"error","message":"..."}
 */
router.post('/', async (req, res) => {
  const { userId = 'default', messages = [], context = {} } = req.body || {};

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    // Prefer the live app context; fall back to last-known server snapshot.
    const session = getSession(userId);
    const merged = {
      profile: context.profile || session.profile,
      cubes: context.cubes || session.budget?.cubes || [],
      mainAccount: context.mainAccount ?? session.mainAccount ?? 0,
    };

    const userMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (userMsg) appendChat(userId, userMsg);

    const full = await streamChat({
      messages,
      context: merged,
      onDelta: (text) => send({ type: 'delta', text }),
    });

    appendChat(userId, { role: 'assistant', content: full });
    send({ type: 'done', full, alerts: evaluateAlerts(merged.cubes), live: isLive() });
  } catch (e) {
    send({ type: 'error', message: e.message || 'chat failed' });
  } finally {
    res.end();
  }
});

/** Non-streaming variant for clients/tests that don't want SSE. */
router.post('/sync', async (req, res) => {
  const { messages = [], context = {} } = req.body || {};
  try {
    let full = '';
    await streamChat({ messages, context, onDelta: (t) => (full += t) });
    res.json({ reply: full, alerts: evaluateAlerts(context.cubes || []), live: isLive() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
