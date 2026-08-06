// Drains the Green API notification queue and dispatches each event to a
// handler. Green API redelivers anything that isn't deleted, so a notification
// is deleted once the handler has returned — a handler that throws leaves the
// notification queued for the next pass.

import { messageText } from './green-api.mjs';

/**
 * @param {import('./green-api.mjs').GreenApi} api
 * @param {(event: object) => void | Promise<void>} onEvent
 * @param {{ signal?: AbortSignal, receiveTimeout?: number, onError?: (err: Error) => void }} opts
 */
export async function listen(api, onEvent, opts = {}) {
  const { signal, receiveTimeout = 20, onError = console.error } = opts;

  while (!signal?.aborted) {
    let notification;
    const startedAt = Date.now();
    try {
      notification = await api.receiveNotification(receiveTimeout, signal);
    } catch (err) {
      if (signal?.aborted) break;
      onError(err);
      await sleep(5_000, signal);
      continue;
    }

    // Empty queue. Green API normally holds the request open for receiveTimeout
    // seconds, but pause briefly if it returned early so a fast-replying
    // instance can't turn this into a hot loop.
    if (!notification?.receiptId) {
      if (Date.now() - startedAt < 1_000) await sleep(1_000, signal);
      continue;
    }

    try {
      await onEvent(normalize(notification.body ?? {}));
    } catch (err) {
      onError(err);
      continue; // leave it queued for a retry
    }

    try {
      await api.deleteNotification(notification.receiptId);
    } catch (err) {
      onError(err);
    }
  }
}

/**
 * Reshapes a raw webhook body into a flat event. Message webhooks gain
 * `text`, `messageType`, `chatId`, `senderName` and `idMessage`; everything
 * else keeps its raw body under `raw` with the webhook type on `type`.
 */
export function normalize(body) {
  const type = body.typeWebhook;
  const base = {
    type,
    timestamp: body.timestamp ?? null,
    raw: body,
  };

  if (type === 'incomingMessageReceived' || type === 'outgoingMessageReceived' ||
      type === 'outgoingAPIMessageReceived') {
    const { text, type: messageType, url, fileName } = messageText(body.messageData);
    return {
      ...base,
      direction: type === 'incomingMessageReceived' ? 'in' : 'out',
      idMessage: body.idMessage ?? null,
      chatId: body.senderData?.chatId ?? null,
      senderName: body.senderData?.senderName ?? body.senderData?.sender ?? null,
      messageType,
      text,
      url: url ?? null,
      fileName: fileName ?? null,
    };
  }

  if (type === 'outgoingMessageStatus') {
    return { ...base, idMessage: body.idMessage ?? null, status: body.status ?? null };
  }

  if (type === 'stateInstanceChanged') {
    return { ...base, stateInstance: body.stateInstance ?? null };
  }

  return base;
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}
