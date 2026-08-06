// Minimal Green API (WhatsApp) client — no dependencies, Node 18+.
//
// Credentials come from the environment, never from source:
//   GREEN_API_URL       e.g. https://7107.api.greenapi.com
//   GREEN_API_INSTANCE  the waInstance id
//   GREEN_API_TOKEN     the instance API token

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

  // Green API puts the token in the path, so keep it out of logs and error text.
  #url(method) {
    const { apiUrl, instanceId, token } = this.config;
    return `${apiUrl}/waInstance${instanceId}/${method}/${token}`;
  }

  async #request(method, { body, timeoutMs = 30_000 } = {}) {
    const signal = AbortSignal.timeout(timeoutMs);
    let res;
    try {
      res = await fetch(this.#url(method), {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (cause) {
      throw new GreenApiError(`${method} failed: ${cause.message}`, { body: null });
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

  /** "authorized" | "notAuthorized" | "blocked" | "sleepMode" | "starting" */
  async getStateInstance() {
    const r = await this.#request('getStateInstance');
    return r?.stateInstance ?? null;
  }

  /** Account details of the linked phone (only meaningful once authorized). */
  getWaSettings() {
    return this.#request('getWaSettings');
  }

  getSettings() {
    return this.#request('getSettings');
  }

  /**
   * Login QR code. Returns { type: 'qrCode', message: <base64 png> } while
   * waiting to be scanned, or { type: 'alreadyLogged' } once linked.
   * The code rotates roughly every 20 seconds.
   */
  getQr() {
    return this.#request('qr');
  }

  /** chatId is `<international number>@c.us`, e.g. 972501234567@c.us */
  sendMessage(chatId, message) {
    return this.#request('sendMessage', { body: { chatId, message } });
  }

  logout() {
    return this.#request('logout');
  }

  reboot() {
    return this.#request('reboot');
  }
}

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
