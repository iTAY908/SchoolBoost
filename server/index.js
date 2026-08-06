'use strict';

const http = require('node:http');
const { loadConfig } = require('./config');
const { GreenApiClient, GreenApiError } = require('./greenapi');
const { createWebhookHandler } = require('./webhook');
const { startPoller } = require('./poller');

const MAX_BODY_BYTES = 1_000_000;

/**
 * Reads and JSON-parses a request body, refusing anything oversized so a
 * large or hung upload cannot pin memory.
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Body is not valid JSON'));
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

/** Default inbound handler — logs. Replace with SchoolBoost's own routing. */
function logMessage(message) {
  const who = message.senderName ? `${message.senderName} <${message.sender}>` : message.sender;
  console.log(`[in] ${who}: ${message.kind === 'text' ? message.text : `(${message.kind})`}`);
}

function createServer({ config, client, onMessage = logMessage }) {
  const handleWebhook = createWebhookHandler({
    webhookToken: config.webhookToken,
    onMessage,
  });

  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    try {
      if (req.method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { ok: true });
      }

      // Connection check. Proxies Green API's own state so the answer is
      // authoritative rather than inferred from config being present.
      if (req.method === 'GET' && pathname === '/api/state') {
        const state = await client.getStateInstance();
        return sendJson(res, 200, {
          connected: state?.stateInstance === 'authorized',
          state: state?.stateInstance ?? null,
        });
      }

      if (req.method === 'POST' && pathname === '/api/send') {
        const body = await readJsonBody(req);
        const to = body?.to;
        const message = body?.message;
        if (!to || !message) {
          return sendJson(res, 400, { error: 'Both "to" and "message" are required' });
        }
        const result = await client.sendMessage(to, message);
        return sendJson(res, 200, { ok: true, idMessage: result?.idMessage ?? null });
      }

      if (req.method === 'POST' && pathname === '/webhook') {
        const body = await readJsonBody(req);
        return handleWebhook(req, res, body);
      }

      return sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      if (err instanceof GreenApiError) {
        console.error('[greenapi]', err.message, err.body ?? '');
        return sendJson(res, 502, { error: 'Green API request failed', detail: err.message });
      }
      console.error('[server]', err);
      return sendJson(res, 500, { error: 'Internal error' });
    }
  });
}

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const client = new GreenApiClient(config);

  if (!config.webhookToken) {
    console.warn(
      '[warn] GREEN_API_WEBHOOK_TOKEN is not set — /webhook accepts unauthenticated ' +
        'requests. Set it before exposing this server publicly.'
    );
  }

  const server = createServer({ config, client });

  server.listen(config.port, () => {
    console.log(`SchoolBoost WhatsApp bridge listening on :${config.port}`);
    console.log(`  GET  /api/state   instance connection state`);
    console.log(`  POST /api/send    { "to": "0501234567", "message": "..." }`);
    console.log(`  POST /webhook     incoming messages from Green API`);
  });

  // Polling is opt-in: only one reader should drain the queue, so enable it
  // when webhooks are not configured, not alongside them.
  let poller = null;
  if (process.env.GREEN_API_POLL === '1') {
    console.log('Polling for incoming messages (GREEN_API_POLL=1)');
    poller = startPoller({ client, onMessage: logMessage });
  }

  const shutdown = async () => {
    console.log('\nShutting down…');
    if (poller) await poller.stop();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) main();

module.exports = { createServer, readJsonBody };
