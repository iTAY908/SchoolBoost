// ============================================================================
// Worker 3 — Backend server entry (Express)
// ============================================================================

const express = require('express');
const cors = require('cors');
const config = require('./config');
const budgetRoutes = require('./routes/budget');
const chatRoutes = require('./routes/chat');
const stateRoutes = require('./routes/state');
const { isLive } = require('./services/aiClient');

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) =>
  res.json({ ok: true, ai: isLive() ? 'live' : 'rule-based-fallback', model: config.chatModel })
);

app.use('/api/budget', budgetRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/state', stateRoutes);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  console.log(`CubeFinance backend on :${config.port} (AI: ${isLive() ? 'live' : 'fallback'})`);
});

module.exports = app;
