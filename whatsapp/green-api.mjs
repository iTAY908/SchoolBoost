// Green API (WhatsApp) client — no dependencies, Node 18+.
//
// Credentials come from the environment, never from source:
//   GREEN_API_URL       e.g. https://7107.api.greenapi.com
//   GREEN_API_INSTANCE  the waInstance id
//   GREEN_API_TOKEN     the instance API token
//
// Green API puts the token in the request path, so nothing here ever logs or
// embeds a full URL — errors carry the method name only.

export class GreenApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'GreenApiError';
    this.status = status;
    this.body = body;
  }
}

export function configFromEnv(env = process.env) {
  const apiUrl = (env.GREEN_API_URL || '').replace(/\/+$/, '');
  const instanceId = env.GREEN_API_INSTANCE || '';
  const token = env.GREEN_API_TOKEN || '';

  const missing = [
    !apiUrl && 'GREEN_API_URL',
    !instanceId && 'GREEN_API_INSTANCE',
    !token && 'GREEN_API_TOKEN',
  ].filter(Boolean);

  if (missing.length) {
    throw new GreenApiError(`Missing environment variables: ${missing.join(', ')}`);
  }
  return { apiUrl, instanceId, token };
}

export class GreenApi {
  constructor(config = configFromEnv()) {
    this.config = config;
  }

  #url(method, query) {
    const { apiUrl, instanceId, token } = this.config;
    const qs = query ? `?${new URLSearchParams(query)}` : '';
    return `${apiUrl}/waInstance${instanceId}/${method}/${token}${qs}`;
  }

  async request(method, { body, query, httpMethod, timeoutMs = 60_000, signal } = {}) {
    const verb = httpMethod || (body ? 'POST' : 'GET');
    // Caller-supplied signal aborts a long poll immediately; the timeout is the backstop.
    const combined = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);

    let res;
    try {
      res = await fetch(this.#url(method, query), {
        method: verb,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: combined,
      });
    } catch (cause) {
      if (signal?.aborted) throw cause;
      throw new GreenApiError(`${method} failed: ${cause.message}`);
    }

    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      throw new GreenApiError(`${method} returned HTTP ${res.status}`, {
        status: res.status,
        body: parsed,
      });
    }
    return parsed;
  }

  // ── Account / session ──────────────────────────────────────────────

  /** "authorized" | "notAuthorized" | "blocked" | "sleepMode" | "starting" */
  async getStateInstance() {
    const r = await this.request('getStateInstance');
    return r?.stateInstance ?? null;
  }

  /** Account details of the linked phone (only meaningful once authorized). */
  getWaSettings() {
    return this.request('getWaSettings');
  }

  getSettings() {
    return this.request('getSettings');
  }

  /** e.g. { incomingWebhook: 'yes', outgoingMessageWebhook: 'yes' } */
  setSettings(settings) {
    return this.request('setSettings', { body: settings });
  }

  /**
   * Login QR code. Returns { type: 'qrCode', message: <base64 png> } while
   * waiting to be scanned, or { type: 'alreadyLogged' } once linked.
   * The code rotates roughly every 20 seconds.
   */
  getQr() {
    return this.request('qr');
  }

  logout() {
    return this.request('logout');
  }

  reboot() {
    return this.request('reboot');
  }

  // ── Sending ────────────────────────────────────────────────────────

  /** chatId is `<international number>@c.us`, or `<id>@g.us` for a group. */
  sendMessage(chatId, message, opts = {}) {
    return this.request('sendMessage', { body: { chatId, message, ...opts } });
  }

  sendFileByUrl(chatId, urlFile, fileName, opts = {}) {
    return this.request('sendFileByUrl', {
      body: { chatId, urlFile, fileName, ...opts },
    });
  }

  sendLocation(chatId, latitude, longitude, opts = {}) {
    return this.request('sendLocation', {
      body: { chatId, latitude, longitude, ...opts },
    });
  }

  sendPoll(chatId, message, options, opts = {}) {
    return this.request('sendPoll', {
      body: { chatId, message, options: options.map((o) => ({ optionName: o })), ...opts },
    });
  }

  forwardMessages(chatId, chatIdFrom, messages) {
    return this.request('forwardMessages', {
      body: { chatId, chatIdFrom, messages },
    });
  }

  // ── Reading ────────────────────────────────────────────────────────

  /** Most recent messages in a chat, newest last. */
  getChatHistory(chatId, count = 50) {
    return this.request('getChatHistory', { body: { chatId, count } });
  }

  /** A single message by id. */
  getMessage(chatId, idMessage) {
    return this.request('getMessage', { body: { chatId, idMessage } });
  }

  /** Incoming messages across all chats from the last N minutes (max 1440). */
  lastIncomingMessages(minutes = 1440) {
    return this.request('lastIncomingMessages', { query: { minutes } });
  }

  lastOutgoingMessages(minutes = 1440) {
    return this.request('lastOutgoingMessages', { query: { minutes } });
  }

  /** All chats known to the instance. */
  getChats() {
    return this.request('getChats');
  }

  /** Mark a chat (or one message in it) as read. */
  readChat(chatId, idMessage) {
    return this.request('readChat', {
      body: idMessage ? { chatId, idMessage } : { chatId },
    });
  }

  // ── Contacts ───────────────────────────────────────────────────────

  getContacts() {
    return this.request('getContacts');
  }

  getContactInfo(chatId) {
    return this.request('getContactInfo', { body: { chatId } });
  }

  getAvatar(chatId) {
    return this.request('getAvatar', { body: { chatId } });
  }

  /**
   * Whether a number has a WhatsApp account. The number is normalized to
   * international form first — Green API expects a full country code, and a
   * bare local number would otherwise be checked as-is and always come back
   * negative.
   */
  checkWhatsapp(phoneNumber) {
    const digits = toChatId(String(phoneNumber)).split('@')[0];
    return this.request('checkWhatsapp', { body: { phoneNumber: Number(digits) } });
  }

  // ── Groups ─────────────────────────────────────────────────────────

  createGroup(groupName, chatIds) {
    return this.request('createGroup', { body: { groupName, chatIds } });
  }

  getGroupData(groupId) {
    return this.request('getGroupData', { body: { groupId } });
  }

  // ── Incoming notification queue ────────────────────────────────────

  /**
   * Long-polls the instance's notification queue. Resolves to
   * { receiptId, body } when an event is waiting, or null when the queue is
   * empty (Green API holds the request open for receiveTimeout seconds first).
   * Every notification must be deleted after handling or it will be redelivered.
   */
  receiveNotification(receiveTimeout = 20, signal) {
    return this.request('receiveNotification', {
      query: { receiveTimeout },
      timeoutMs: (receiveTimeout + 15) * 1000,
      signal,
    });
  }

  deleteNotification(receiptId) {
    return this.request(`deleteNotification/${receiptId}`, { httpMethod: 'DELETE' });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** 972501234567 / +972-50-123-4567 / 0501234567 → 972501234567@c.us */
export function toChatId(phone, defaultCountryCode = '972') {
  if (typeof phone !== 'string') throw new GreenApiError('phone must be a string');
  if (phone.includes('@')) return phone;

  let digits = phone.replace(/\D/g, '');
  if (!digits) throw new GreenApiError(`Cannot parse phone number: ${phone}`);

  // Local Israeli form (leading 0) → swap the trunk prefix for the country code.
  if (digits.startsWith('0')) digits = defaultCountryCode + digits.slice(1);

  return `${digits}@c.us`;
}

/**
 * Flattens the many shapes Green API uses for message bodies into
 * { type, text, caption, url, fileName } — text is null for anything with no
 * readable body (a sticker, a reaction, an unsupported type).
 *
 * Webhook payloads nest the body under `<type>Data` keys, while the REST
 * history endpoints return the same fields flattened onto the message itself.
 * Both shapes are accepted.
 */
export function messageText(messageData = {}) {
  const type = messageData.typeMessage;

  switch (type) {
    case 'textMessage':
      return {
        type,
        text: messageData.textMessageData?.textMessage ?? messageData.textMessage ?? null,
      };

    case 'extendedTextMessage':
    case 'quotedMessage':
      return {
        type,
        text: messageData.extendedTextMessageData?.text
          ?? messageData.extendedTextMessage?.text
          ?? messageData.textMessage
          ?? null,
      };

    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
    case 'audioMessage':
    case 'stickerMessage': {
      const f = messageData.fileMessageData ?? messageData;
      return {
        type,
        text: f.caption || null,
        caption: f.caption ?? null,
        url: f.downloadUrl ?? null,
        fileName: f.fileName ?? null,
      };
    }

    case 'locationMessage': {
      const l = messageData.locationMessageData ?? messageData.location ?? messageData;
      const coords = l.latitude != null ? `${l.latitude}, ${l.longitude}` : null;
      return { type, text: l.nameLocation || l.address || coords };
    }

    case 'contactMessage': {
      const c = messageData.contactMessageData ?? messageData.contact ?? messageData;
      return { type, text: c.displayName ?? null };
    }

    case 'pollMessage': {
      const p = messageData.pollMessageData ?? messageData;
      return { type, text: p.name ?? null };
    }

    default:
      return { type: type ?? 'unknown', text: null };
  }
}
