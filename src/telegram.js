import { log } from './config.js';

export class TelegramError extends Error {
  constructor(method, code, description, parameters) {
    super(`${method} נכשל (${code}): ${description}`);
    this.name = 'TelegramError';
    this.code = code;
    this.description = description;
    this.parameters = parameters || {};
  }
}

export class Telegram {
  /**
   * @param {string} token
   * @param {{fetchImpl?: Function}} [opts] - הזרקת fetch לצורך בדיקות אופליין
   */
  constructor(token, opts = {}) {
    this.token = token;
    this.apiBase = opts.apiBase || 'https://api.telegram.org';
    this.fetch = opts.fetchImpl || globalThis.fetch;
    this.offset = 0;
    this.stopped = false;
    this.me = null;
  }

  async call(method, payload = {}, { timeoutMs = 20000 } = {}) {
    const url = `${this.apiBase}/bot${this.token}/${method}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await res.json();
      if (!body.ok) {
        throw new TelegramError(method, body.error_code, body.description, body.parameters);
      }
      return body.result;
    } finally {
      clearTimeout(timer);
    }
  }

  /** שליחת הודעה; חותכת טקסט ארוך מדי כדי לא להיכשל על מגבלת 4096 תווים. */
  sendMessage(chatId, text, extra = {}) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text: clamp(text, 4096),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    });
  }

  editMessageText(chatId, messageId, text, extra = {}) {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: clamp(text, 4096),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    });
  }

  answerCallbackQuery(id, text, showAlert = false) {
    return this.call('answerCallbackQuery', {
      callback_query_id: id,
      text: text ? clamp(text, 200) : undefined,
      show_alert: showAlert,
    });
  }

  setMyCommands(commands) {
    return this.call('setMyCommands', { commands });
  }

  getMe() {
    return this.call('getMe');
  }

  deleteWebhook() {
    return this.call('deleteWebhook', { drop_pending_updates: false });
  }

  /**
   * לולאת long polling. קוראת ל-onUpdate לכל עדכון, ולא נופלת בגלל
   * שגיאה בעדכון בודד או ניתוק רשת זמני.
   */
  async startPolling(onUpdate) {
    this.stopped = false;
    let backoff = 1000;

    while (!this.stopped) {
      try {
        const updates = await this.call('getUpdates', {
          offset: this.offset,
          timeout: 30,
          allowed_updates: ['message', 'callback_query'],
        }, { timeoutMs: 45000 });

        backoff = 1000;

        for (const update of updates) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          try {
            await onUpdate(update);
          } catch (err) {
            // עדכון בעייתי לא מפיל את הבוט
            log.error('טיפול בעדכון נכשל:', err?.stack || err);
          }
        }
      } catch (err) {
        if (this.stopped) break;

        if (err instanceof TelegramError) {
          if (err.code === 409) {
            // מופע נוסף רץ במקביל, או שמוגדר webhook
            log.warn('התנגשות 409 - מנסה להסיר webhook ולהמשיך');
            await this.deleteWebhook().catch(() => {});
          } else if (err.code === 401) {
            log.error('הטוקן נדחה (401). בדוק את TELEGRAM_BOT_TOKEN.');
            throw err;
          } else if (err.code === 429) {
            const wait = (err.parameters.retry_after || 5) * 1000;
            log.warn(`הוגבל קצב, ממתין ${wait}ms`);
            await sleep(wait);
            continue;
          }
        }

        log.warn(`שגיאת polling (${err?.message || err}) - ניסיון חוזר בעוד ${backoff}ms`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30000);
      }
    }
  }

  stop() {
    this.stopped = true;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(text, max) {
  const s = String(text ?? '');
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
