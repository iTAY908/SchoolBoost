'use strict';

const { timingSafeEqual } = require('node:crypto');
const { parseIncoming } = require('./messages');

/**
 * Validates the bearer token Green API attaches to outgoing webhooks.
 *
 * Compared in constant time so the check cannot be turned into an oracle by
 * timing repeated requests. When no token is configured the endpoint is left
 * open — acceptable only for local testing, and warned about at startup.
 */
function isAuthorized(req, expectedToken) {
  if (!expectedToken) return true;

  const header = req.headers['authorization'] || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : header;

  const a = Buffer.from(presented);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Builds the POST /webhook handler.
 *
 * @param {object} opts
 * @param {string} opts.webhookToken  Shared secret, '' to disable the check.
 * @param {(msg: object) => void|Promise<void>} opts.onMessage  Inbound handler.
 */
function createWebhookHandler({ webhookToken, onMessage }) {
  return async function handleWebhook(req, res, body) {
    if (!isAuthorized(req, webhookToken)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    // Acknowledge immediately. Green API retries on a non-2xx, so slow or
    // failing downstream work must never hold this response open.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));

    const message = parseIncoming(body);
    if (!message) return; // status update, state change, etc.

    try {
      await onMessage(message);
    } catch (err) {
      console.error('[webhook] handler threw:', err.message);
    }
  };
}

module.exports = { createWebhookHandler, isAuthorized };
