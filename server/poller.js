'use strict';

const { parseIncoming } = require('./messages');

/**
 * Reads incoming messages by polling, for when Green API cannot reach a
 * public webhook url (local development, private network, blocked egress).
 *
 * Green API holds each receiveNotification open for ~20s before returning
 * null, so this loop is not a busy-wait — it is long-polling.
 */
function startPoller({ client, onMessage, onError = null }) {
  let running = true;
  let backoffMs = 1_000;
  const MAX_BACKOFF_MS = 60_000;

  async function loop() {
    while (running) {
      let notification;
      try {
        notification = await client.receiveNotification();
        backoffMs = 1_000; // reset only after a clean round-trip
      } catch (err) {
        if (!running) break;
        if (onError) onError(err);
        else console.error('[poller]', err.message);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        continue;
      }

      if (!notification) continue; // empty queue

      const { receiptId, body } = notification;
      try {
        const message = parseIncoming(body);
        if (message) await onMessage(message);
      } catch (err) {
        if (onError) onError(err);
        else console.error('[poller] handler threw:', err.message);
      } finally {
        // Delete even when the handler failed, otherwise the same message is
        // redelivered forever and blocks everything queued behind it.
        try {
          await client.deleteNotification(receiptId);
        } catch (err) {
          console.error('[poller] failed to ack receipt', receiptId, err.message);
        }
      }
    }
  }

  const finished = loop();

  return {
    stop() {
      running = false;
      return finished;
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { startPoller };
