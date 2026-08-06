'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const { createServer } = require('../server/index');
const { GreenApiClient } = require('../server/greenapi');

/** Stands in for Green API so the tests exercise real HTTP without leaving the box. */
function startMockGreenApi() {
  const received = [];

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ url: req.url, body: body ? JSON.parse(body) : null });
      res.setHeader('Content-Type', 'application/json');

      if (req.url.includes('/getStateInstance/')) {
        res.end(JSON.stringify({ stateInstance: 'authorized' }));
      } else if (req.url.includes('/sendMessage/')) {
        res.end(JSON.stringify({ idMessage: 'MSG-1' }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'unknown method' }));
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, received, port: server.address().port });
    });
  });
}

function startBridge({ upstreamPort, webhookToken = '', onMessage }) {
  const config = {
    idInstance: '1234567890',
    apiTokenInstance: 'b'.repeat(50),
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    webhookToken,
    defaultCountryCode: '972',
    port: 0,
  };
  const client = new GreenApiClient(config);
  const server = createServer({ config, client, onMessage: onMessage || (() => {}) });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function call(port, path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

test('bridge server', async (t) => {
  const upstream = await startMockGreenApi();
  const inbound = [];
  const bridge = await startBridge({
    upstreamPort: upstream.port,
    webhookToken: 'hook-secret',
    onMessage: (m) => inbound.push(m),
  });

  t.after(() => {
    bridge.server.close();
    upstream.server.close();
  });

  await t.test('GET /health', async () => {
    const { status, json } = await call(bridge.port, '/health');
    assert.equal(status, 200);
    assert.deepEqual(json, { ok: true });
  });

  await t.test('GET /api/state reports the upstream connection state', async () => {
    const { status, json } = await call(bridge.port, '/api/state');
    assert.equal(status, 200);
    assert.deepEqual(json, { connected: true, state: 'authorized' });
  });

  await t.test('POST /api/send forwards a normalised chat id upstream', async () => {
    const { status, json } = await call(bridge.port, '/api/send', {
      method: 'POST',
      body: { to: '0501234567', message: 'hello' },
    });

    assert.equal(status, 200);
    assert.deepEqual(json, { ok: true, idMessage: 'MSG-1' });

    const sent = upstream.received.at(-1);
    assert.ok(sent.url.includes('/sendMessage/'));
    assert.equal(sent.body.chatId, '972501234567@c.us');
    assert.equal(sent.body.message, 'hello');
  });

  await t.test('POST /api/send rejects an incomplete payload', async () => {
    const { status, json } = await call(bridge.port, '/api/send', {
      method: 'POST',
      body: { to: '0501234567' },
    });
    assert.equal(status, 400);
    assert.match(json.error, /required/);
  });

  await t.test('POST /webhook rejects a wrong or missing token', async () => {
    const missing = await call(bridge.port, '/webhook', {
      method: 'POST',
      body: { typeWebhook: 'incomingMessageReceived' },
    });
    assert.equal(missing.status, 401);

    const wrong = await call(bridge.port, '/webhook', {
      method: 'POST',
      body: { typeWebhook: 'incomingMessageReceived' },
      headers: { Authorization: 'Bearer nope' },
    });
    assert.equal(wrong.status, 401);
    assert.equal(inbound.length, 0, 'rejected webhooks must not reach the handler');
  });

  await t.test('POST /webhook delivers an authorised message to the handler', async () => {
    const { status } = await call(bridge.port, '/webhook', {
      method: 'POST',
      headers: { Authorization: 'Bearer hook-secret' },
      body: {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'IN-1',
        senderData: { chatId: '972501234567@c.us', senderName: 'Itay' },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'hi' } },
      },
    });

    assert.equal(status, 200);
    // The handler runs after the response is flushed; give it a tick.
    await new Promise((r) => setImmediate(r));
    assert.equal(inbound.length, 1);
    assert.equal(inbound[0].text, 'hi');
    assert.equal(inbound[0].senderName, 'Itay');
  });

  await t.test('unknown route 404s', async () => {
    const { status } = await call(bridge.port, '/nope');
    assert.equal(status, 404);
  });
});
