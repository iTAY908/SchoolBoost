'use strict';

/**
 * Thin client over the Green API HTTP interface.
 *
 * Every endpoint follows the same shape:
 *   {baseUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
 *
 * The token appears in the URL path — that is Green API's design, not ours.
 * It means request URLs are credential-bearing: never log a raw URL, and
 * never let one reach the browser. `redactUrl` below exists for that reason.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

class GreenApiError extends Error {
  constructor(message, { status, method, body } = {}) {
    super(message);
    this.name = 'GreenApiError';
    this.status = status;
    this.method = method;
    this.body = body;
  }
}

/** Strips the API token out of a URL so it is safe to put in a log line. */
function redactUrl(url) {
  return String(url).replace(/\/[0-9a-f]{40,}(?=\/?$)/i, '/<token>');
}

class GreenApiClient {
  constructor(config) {
    this.idInstance = config.idInstance;
    this.apiTokenInstance = config.apiTokenInstance;
    this.baseUrl = config.baseUrl;
    this.defaultCountryCode = config.defaultCountryCode || '972';
  }

  #url(method) {
    return `${this.baseUrl}/waInstance${this.idInstance}/${method}/${this.apiTokenInstance}`;
  }

  async #request(method, { body, httpMethod = 'POST', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const url = this.#url(method);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(url, {
        method: httpMethod,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (cause) {
      const reason =
        cause.name === 'AbortError'
          ? `timed out after ${timeoutMs}ms`
          : `network error: ${cause.message}`;
      throw new GreenApiError(`${method} failed — ${reason} (${redactUrl(url)})`, { method });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      throw new GreenApiError(
        `${method} returned HTTP ${response.status}`,
        { status: response.status, method, body: parsed }
      );
    }

    return parsed;
  }

  /**
   * Converts a phone number into a Green API chat id.
   * Accepts `050-123-4567`, `+972501234567`, `972501234567`, or an id that is
   * already in `...@c.us` / `...@g.us` form (returned untouched).
   */
  toChatId(input) {
    const raw = String(input || '').trim();
    if (!raw) throw new Error('Empty phone number / chat id');
    if (raw.endsWith('@c.us') || raw.endsWith('@g.us')) return raw;

    let digits = raw.replace(/\D/g, '');
    if (!digits) throw new Error(`Cannot derive a chat id from "${input}"`);

    // Local form (leading 0) — swap it for the country code.
    if (digits.startsWith('0')) {
      digits = this.defaultCountryCode + digits.slice(1);
    }
    return `${digits}@c.us`;
  }

  // ── Connection ────────────────────────────────────────────────

  /**
   * Returns { stateInstance: 'authorized' | 'notAuthorized' | 'blocked' |
   * 'sleepMode' | 'starting' }. `authorized` is the only state in which
   * messages can be sent or received.
   */
  getStateInstance() {
    return this.#request('getStateInstance', { httpMethod: 'GET' });
  }

  /** Instance settings, including the configured webhook url. */
  getSettings() {
    return this.#request('getSettings', { httpMethod: 'GET' });
  }

  // ── Sending ───────────────────────────────────────────────────

  /** Sends a plain text message. Returns { idMessage }. */
  sendMessage(to, message, { quotedMessageId } = {}) {
    return this.#request('sendMessage', {
      body: {
        chatId: this.toChatId(to),
        message: String(message),
        ...(quotedMessageId ? { quotedMessageId } : {}),
      },
    });
  }

  /** Sends a file referenced by a publicly reachable URL. */
  sendFileByUrl(to, { urlFile, fileName, caption }) {
    if (!urlFile || !fileName) {
      throw new Error('sendFileByUrl requires both urlFile and fileName');
    }
    return this.#request('sendFileByUrl', {
      body: {
        chatId: this.toChatId(to),
        urlFile,
        fileName,
        ...(caption ? { caption } : {}),
      },
    });
  }

  // ── Receiving (polling) ───────────────────────────────────────
  //
  // Two ways to read incoming messages:
  //   1. Webhooks — Green API POSTs to a public https url. See webhook.js.
  //   2. Polling  — receiveNotification/deleteNotification, below. Works
  //      without a public url, which makes it the option that runs on a
  //      laptop or inside a private network.
  //
  // A notification stays in the queue until it is explicitly deleted, so
  // every processed receipt MUST be deleted or it will be served again.

  /**
   * Long-polls for the next queued notification. Resolves to `null` when the
   * queue is empty (Green API holds the connection open for ~20s first).
   */
  receiveNotification() {
    return this.#request('receiveNotification', {
      httpMethod: 'GET',
      timeoutMs: 60_000,
    });
  }

  /** Acknowledges a notification so it is not delivered again. */
  deleteNotification(receiptId) {
    return this.#request(`deleteNotification/${receiptId}`, { httpMethod: 'DELETE' });
  }
}

module.exports = { GreenApiClient, GreenApiError, redactUrl };
