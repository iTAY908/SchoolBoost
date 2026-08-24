import { log } from './config.js';
import { bold, esc, keyboard } from './ui.js';
import { now, todayKey, weekdayOf, daysBetween } from './time.js';
import { buildDigest } from './digest.js';
import { openItems } from './features/homework.js';
import { upcoming } from './features/exams.js';
import { sleep } from './telegram.js';

const TICK_MS = 30_000;
const KEEP_SENT_MS = 7 * 86400_000;

export class Scheduler {
  constructor({ tg, store, tz, intervalMs = TICK_MS }) {
    this.tg = tg;
    this.store = store;
    this.tz = tz;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.tick().catch((err) => log.error('שגיאה במתזמן:', err?.stack || err));
    }, this.intervalMs);
    log.info(`המתזמן פעיל (בדיקה כל ${Math.round(this.intervalMs / 1000)} שניות)`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(atMs = Date.now()) {
    let sent = 0;
    for (const chatId of this.store.chatIds()) {
      const chat = this.store.chat(chatId);
      if (chat.blocked) continue;
      sent += await this.sendDueReminders(chatId, chat, atMs);
      sent += await this.sendDigest(chatId, chat);
    }
    if (sent) this.store.flush();
    return sent;
  }

  async sendDueReminders(chatId, chat, atMs) {
    const due = chat.reminders.filter((r) => !r.sent && r.at <= atMs);
    let count = 0;

    for (const reminder of due) {
      const text = [bold('⏰ תזכורת'), '', esc(reminder.text)].join('\n');
      const ok = await this.deliver(chatId, chat, text, keyboard([[['⏰ לתזכורות', 'rm:menu']]]));
      if (!ok) break; // המשתמש חסם את הבוט - אין טעם להמשיך
      reminder.sent = true;
      reminder.sentAt = atMs;
      this.store.markDirty();
      count += 1;
      await sleep(120);
    }

    // ניקוי תזכורות ישנות שכבר נשלחו
    const before = chat.reminders.length;
    chat.reminders = chat.reminders.filter((r) => !r.sent || (atMs - (r.sentAt || 0)) < KEEP_SENT_MS);
    if (chat.reminders.length !== before) this.store.markDirty();

    return count;
  }

  async sendDigest(chatId, chat) {
    const settings = chat.settings;
    if (!settings.digestEnabled) return 0;

    const tz = settings.tz || this.tz;
    const t = now(tz);
    const today = todayKey(tz);

    if (chat.digest.lastSent === today) return 0;
    // חלון של שעתיים כדי לא לשלוח סיכום מאוחר אחרי הפעלה מחדש בערב
    if (t.hour < settings.digestHour || t.hour >= settings.digestHour + 2) return 0;
    if (!hasSomethingToSay(chat, tz, today)) {
      chat.digest.lastSent = today;
      this.store.markDirty();
      return 0;
    }

    const ok = await this.deliver(chatId, chat, buildDigest(chat, tz), keyboard([
      [['📝 מטלות', 'hw:menu'], ['🎯 מבחנים', 'ex:menu']],
      [['🎒 תפריט', 'core:menu']],
    ]));
    if (!ok) return 0;

    chat.digest.lastSent = today;
    this.store.markDirty();
    return 1;
  }

  /** שולח ומטפל בחסימות; מחזיר false אם אין טעם להמשיך לשלוח לצ'אט הזה. */
  async deliver(chatId, chat, text, extra) {
    try {
      await this.tg.sendMessage(chatId, text, extra);
      return true;
    } catch (err) {
      if (err?.code === 403) {
        log.warn(`הצ'אט ${chatId} חסם את הבוט - מפסיקים לשלוח אליו`);
        chat.blocked = true;
        this.store.markDirty();
        return false;
      }
      if (err?.code === 429) {
        const wait = (err.parameters?.retry_after || 5) * 1000;
        log.warn(`הוגבל קצב, ממתין ${wait}ms`);
        await sleep(wait);
        return false;
      }
      log.error(`שליחה לצ'אט ${chatId} נכשלה:`, err?.message || err);
      return false;
    }
  }
}

/** בסופ"ש בלי שיעורים, מטלות או מבחנים - אין סיבה להעיר את המשתמש. */
function hasSomethingToSay(chat, tz, today) {
  const dayIndex = weekdayOf(today);
  const lessons = chat.schedule[String(dayIndex)] || [];
  if (lessons.length) return true;
  if (openItems(chat).some((h) => h.due && daysBetween(today, h.due) <= 3)) return true;
  if (upcoming(chat, tz).some((e) => daysBetween(today, e.date) <= 14)) return true;
  return false;
}
