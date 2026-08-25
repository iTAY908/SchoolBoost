import { readFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { log } from './config.js';

/** מבנה ברירת המחדל של צ'אט חדש. */
export function emptyChat(tz) {
  return {
    settings: { tz, digestHour: 7, digestEnabled: true, name: null },
    schedule: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    homework: [],
    exams: [],
    grades: [],
    reminders: [],
    counters: { homework: 0, exams: 0, grades: 0, reminders: 0, lesson: 0 },
    digest: { lastSent: null },
  };
}

/**
 * מאגר JSON פשוט עם כתיבה אטומית ו-debounce.
 * מספיק לחלוטין לעומס של בוט אישי/כיתתי; אפשר להחליף ב-SQLite בהמשך.
 */
export class Store {
  constructor(file, tz) {
    this.file = path.resolve(file);
    this.tz = tz;
    this.data = { chats: {} };
    this.dirty = false;
    this.timer = null;
    this.load();
  }

  load() {
    try {
      if (existsSync(this.file)) {
        const parsed = JSON.parse(readFileSync(this.file, 'utf8'));
        if (parsed && typeof parsed === 'object' && parsed.chats) this.data = parsed;
        log.info(`נטענו נתונים של ${Object.keys(this.data.chats).length} צ'אטים מ-${this.file}`);
      } else {
        log.info(`אין קובץ נתונים ב-${this.file}, מתחילים מאפס`);
      }
    } catch (err) {
      log.error('קריאת קובץ הנתונים נכשלה, מתחילים מאפס:', err.message);
      this.data = { chats: {} };
    }
  }

  /** מחזיר את רשומת הצ'אט, ויוצר אותה אם חסרה. */
  chat(chatId) {
    const key = String(chatId);
    if (!this.data.chats[key]) {
      this.data.chats[key] = emptyChat(this.tz);
      this.markDirty();
    }
    return migrate(this.data.chats[key], this.tz);
  }

  chatIds() {
    return Object.keys(this.data.chats);
  }

  /** מקצה מזהה רץ לישות (homework/exams/...). */
  nextId(chatId, kind) {
    const c = this.chat(chatId);
    c.counters[kind] = (c.counters[kind] || 0) + 1;
    this.markDirty();
    return c.counters[kind];
  }

  markDirty() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 400);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  flush() {
    if (!this.dirty) return;
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      renameSync(tmp, this.file); // החלפה אטומית - לא נשארים עם קובץ חצי־כתוב
      this.dirty = false;
      log.debug('הנתונים נשמרו');
    } catch (err) {
      log.error('שמירת הנתונים נכשלה:', err.message);
    }
  }

  close() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.flush();
  }
}

/** משלים שדות שנוספו בגרסאות מאוחרות יותר, כדי שקבצים ישנים ימשיכו לעבוד. */
function migrate(chat, tz) {
  const base = emptyChat(tz);
  chat.settings = { ...base.settings, ...(chat.settings || {}) };
  chat.counters = { ...base.counters, ...(chat.counters || {}) };
  chat.digest = { ...base.digest, ...(chat.digest || {}) };
  chat.schedule = { ...base.schedule, ...(chat.schedule || {}) };
  for (const key of ['homework', 'exams', 'grades', 'reminders']) {
    if (!Array.isArray(chat[key])) chat[key] = [];
  }
  return chat;
}
