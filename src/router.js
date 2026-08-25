import { log } from './config.js';
import { MAIN_MENU, WELCOME, HELP, keyboard, bold, esc, italic, BACK_ROW } from './ui.js';
import { renderToday } from './digest.js';
import { humanDate } from './time.js';
import { describe as describeReminder } from './features/reminders.js';
import * as quick from './quick.js';

import schedule from './features/schedule.js';
import homework from './features/homework.js';
import exams from './features/exams.js';
import grades from './features/grades.js';
import reminders from './features/reminders.js';
import settings from './features/settings.js';

const FEATURES = [schedule, homework, exams, grades, reminders, settings];

export const BOT_COMMANDS = [
  { command: 'start', description: 'פתיחה ותפריט ראשי' },
  { command: 'menu', description: 'תפריט ראשי' },
  { command: 'today', description: 'הסיכום של היום' },
  { command: 'week', description: 'מערכת שעות שבועית' },
  { command: 'hw', description: 'שיעורי בית' },
  { command: 'exams', description: 'מבחנים קרובים' },
  { command: 'grades', description: 'ציונים וממוצעים' },
  { command: 'remind', description: 'תזכורת חדשה' },
  { command: 'settings', description: 'הגדרות' },
  { command: 'cancel', description: 'ביטול הפעולה הנוכחית' },
  { command: 'reset', description: 'איפוס זיכרון השיחה עם ה-AI' },
  { command: 'help', description: 'עזרה' },
];

export class Router {
  constructor({ tg, store, tz, agent = null }) {
    this.tg = tg;
    this.store = store;
    this.tz = tz;
    this.agent = agent;
    this.sessions = new Map(); // "chatId:userId" -> {name, data}

    this.commands = {};
    this.byName = {};
    this.states = {};

    for (const feature of FEATURES) {
      this.byName[feature.name] = feature;
      Object.assign(this.commands, feature.commands || {});
      Object.assign(this.states, feature.states || {});
    }
  }

  sessionKey(chatId, userId) {
    return `${chatId}:${userId}`;
  }

  makeContext({ chatId, userId, text, callback }) {
    const key = this.sessionKey(chatId, userId);
    const self = this;

    return {
      tg: this.tg,
      store: this.store,
      tz: this.tz,
      chatId,
      userId,
      text: text || '',
      callback: callback || null,
      get chat() { return self.store.chat(chatId); },
      get state() { return self.sessions.get(key) || null; },

      setState(name, data = {}) {
        self.sessions.set(key, { name, data });
      },
      clearState() {
        self.sessions.delete(key);
      },

      reply(payload, extra = {}) {
        const { text: t, ...rest } = normalize(payload, extra);
        return self.tg.sendMessage(chatId, t, rest);
      },

      /** בקריאה מכפתור עורך את ההודעה הקיימת; אחרת שולח חדשה. */
      async render(payload, extra = {}) {
        const { text: t, ...rest } = normalize(payload, extra);
        if (callback?.message) {
          try {
            await self.tg.answerCallbackQuery(callback.id).catch(() => {});
            return await self.tg.editMessageText(chatId, callback.message.message_id, t, rest);
          } catch (err) {
            // "message is not modified" ודומיו - נופלים חזרה לשליחה רגילה
            if (!/not modified/i.test(err?.description || '')) {
              log.debug('עריכת הודעה נכשלה, שולח חדשה:', err?.message);
              return self.tg.sendMessage(chatId, t, rest);
            }
            return null;
          }
        }
        return self.tg.sendMessage(chatId, t, rest);
      },

      answer(t, alert = false) {
        if (!callback) return Promise.resolve(null);
        return self.tg.answerCallbackQuery(callback.id, t, alert).catch(() => null);
      },
    };
  }

  async handleUpdate(update) {
    if (update.message) return this.handleMessage(update.message);
    if (update.callback_query) return this.handleCallback(update.callback_query);
    return null;
  }

  async handleMessage(message) {
    const chatId = message.chat?.id;
    const userId = message.from?.id ?? chatId;
    const text = message.text;
    if (!chatId || typeof text !== 'string') return null;

    const ctx = this.makeContext({ chatId, userId, text });

    if (text.startsWith('/')) return this.handleCommand(ctx, text, message);

    // שלב באמצע שיחה מונחית
    const state = ctx.state;
    if (state) {
      const handler = this.states[state.name];
      if (handler) return handler(ctx);
      ctx.clearState();
    }

    // כתיבה חופשית
    return this.handleFreeText(ctx, message);
  }

  async handleCommand(ctx, text, message) {
    // בקבוצות הפקודה מגיעה כ-/hw@MyBot
    const raw = text.split(/\s+/)[0].toLowerCase();
    const cmd = raw.split('@')[0];

    switch (cmd) {
      case '/start': {
        ctx.clearState();
        const name = message.from?.first_name;
        if (name) {
          ctx.chat.settings.name = name;
          this.store.markDirty();
        }
        const hello = name ? `👋 שלום ${esc(name)}!` : null;
        return ctx.reply(hello ? WELCOME.replace('👋 שלום!', hello) : WELCOME, MAIN_MENU);
      }

      case '/menu':
        ctx.clearState();
        return ctx.reply(mainMenuText(ctx.chat), MAIN_MENU);

      case '/help':
        return ctx.reply(HELP, keyboard([[BACK_ROW]]));

      case '/today':
        return ctx.reply(renderToday(ctx.chat, this.tz, { greeting: false }));

      case '/reset':
        if (!this.agent) return ctx.reply('אין שיחת AI פעילה.', MAIN_MENU);
        this.agent.resetHistory(ctx.chatId);
        return ctx.reply('🧠 שכחתי את השיחה שלנו. מתחילים מחדש.', MAIN_MENU);

      case '/cancel':
        if (!ctx.state) return ctx.reply('אין פעולה פעילה לביטול.', MAIN_MENU);
        ctx.clearState();
        return ctx.reply('בוטל ✅', MAIN_MENU);

      default: {
        const handler = this.commands[cmd];
        if (handler) {
          ctx.clearState();
          return handler(ctx);
        }
        return ctx.reply(
          ['לא מכיר את הפקודה הזו 🤔', '', 'נסה /help כדי לראות מה אני יודע לעשות.'].join('\n'),
          MAIN_MENU,
        );
      }
    }
  }

  /** מעביר את ההודעה לסוכן ה-AI, שולח את התשובה ואת הקבצים שנוצרו. */
  async askAgent(ctx, message) {
    await this.tg.sendChatAction(ctx.chatId, 'typing');

    let result;
    try {
      result = await this.agent.reply({
        store: this.store,
        chatId: ctx.chatId,
        text: ctx.text,
        userName: message?.from?.first_name || ctx.chat.settings.name,
        onProgress: () => this.tg.sendChatAction(ctx.chatId, 'typing'),
      });
    } catch (err) {
      log.error('הסוכן נכשל:', err?.stack || err);
      return ctx.reply(agentErrorText(err), MAIN_MENU);
    }

    if (result.text) {
      // תשובת AI נשלחת כטקסט גולמי - היא לא מובטחת להיות HTML תקין
      await this.tg.sendMessage(ctx.chatId, result.text, { parse_mode: undefined });
    }

    for (const file of result.files) {
      try {
        await this.tg.sendChatAction(ctx.chatId, 'upload_document');
        const { buffer, filename } = await this.agent.downloadFile(file.fileId);
        await this.tg.sendDocument(ctx.chatId, buffer, filename);
      } catch (err) {
        log.error('שליחת הקובץ נכשלה:', err?.message || err);
        await this.tg.sendMessage(ctx.chatId, 'הכנתי את הקובץ אבל השליחה נכשלה 😕 נסה לבקש שוב.');
      }
    }

    if (!result.text && !result.files.length) {
      await this.tg.sendMessage(ctx.chatId, 'לא הצלחתי לנסח תשובה. תנסה לנסח אחרת?');
    }
    return null;
  }

  async handleFreeText(ctx, message) {
    const intent = quick.detect(ctx.text, this.tz);

    if (intent?.kind === 'reminder-partial') {
      ctx.setState('rm:when', { text: intent.text });
      return ctx.reply(
        [`⏰ ${bold(intent.text)}`, '', 'מתי להזכיר לך?', italic('למשל: מחר 18:00')].join('\n'),
      );
    }

    const result = quick.apply(intent, ctx);
    if (!result) {
      if (this.agent) return this.askAgent(ctx, message);
      return ctx.reply(
        [
          'לא בטוח מה לעשות עם זה 🤔',
          '',
          'אפשר לכתוב לי למשל:',
          '• <code>שיעורי בית מתמטיקה תרגילים 4-7 מחר</code>',
          '• <code>מבחן אנגלית 12.6</code>',
          '• <code>ציון 95 בהיסטוריה</code>',
          '• <code>תזכיר לי מחר 18:00 להביא ציוד ספורט</code>',
          '',
          'או פשוט לבחור מהתפריט:',
        ].join('\n'),
        MAIN_MENU,
      );
    }

    if (result.text) return ctx.reply(result.text);

    const { kind, item } = result;
    switch (kind) {
      case 'homework':
        return ctx.reply(
          ['✅ נוספה מטלה:', `${bold(item.subject)} — ${esc(item.title)}`,
            `📅 ${item.due ? esc(humanDate(item.due, this.tz)) : italic('בלי תאריך')}`].join('\n'),
          keyboard([[['📝 לרשימת המטלות', 'hw:menu']]]),
        );
      case 'exam':
        return ctx.reply(
          ['✅ נוסף מבחן:', `${bold(item.subject)} — ${esc(humanDate(item.date, this.tz))}`].join('\n'),
          keyboard([[['🎯 לרשימת המבחנים', 'ex:menu']]]),
        );
      case 'grade':
        return ctx.reply(
          `✅ נשמר ציון: ${bold(item.subject)} — ${item.value}`,
          keyboard([[['💯 לכל הציונים', 'gr:menu']]]),
        );
      case 'reminder':
        return ctx.reply(
          [`✅ אזכיר לך: ${bold(item.text)}`, `🕐 ${esc(describeReminder(item.at, this.tz))}`].join('\n'),
          keyboard([[['⏰ לכל התזכורות', 'rm:menu']]]),
        );
      default:
        return null;
    }
  }

  async handleCallback(query) {
    const chatId = query.message?.chat?.id;
    const userId = query.from?.id ?? chatId;
    if (!chatId) return this.tg.answerCallbackQuery(query.id).catch(() => null);

    const ctx = this.makeContext({ chatId, userId, callback: query });
    const [feature, action, arg] = String(query.data || '').split(':');

    if (feature === 'core') {
      switch (action) {
        case 'menu':
          ctx.clearState();
          return ctx.render(mainMenuText(ctx.chat), MAIN_MENU);
        case 'today':
          return ctx.render(renderToday(ctx.chat, this.tz, { greeting: false }));
        case 'help':
          return ctx.render(HELP, keyboard([[BACK_ROW]]));
        default:
          return ctx.answer();
      }
    }

    const mod = this.byName[feature];
    if (!mod?.onCallback) return ctx.answer();
    return mod.onCallback(ctx, action, arg);
  }
}

function mainMenuText(chat) {
  const open = chat.homework.filter((h) => !h.done).length;
  const examCount = chat.exams.length;
  const lines = [bold('🎒 SchoolBoost'), ''];
  lines.push(`📝 מטלות פתוחות: ${bold(open)}`);
  lines.push(`🎯 מבחנים במעקב: ${bold(examCount)}`);
  lines.push('', 'מה נעשה?');
  return lines.join('\n');
}

/** מקבל מחרוזת או אובייקט {text, reply_markup} ומחזיר צורה אחידה. */
function normalize(payload, extra) {
  if (typeof payload === 'string') return { text: payload, ...extra };
  return { ...payload, ...extra };
}


function agentErrorText(err) {
  const status = err?.status;
  if (status === 401) return 'מפתח ה-AI לא תקף. בדוק את ANTHROPIC_API_KEY בקובץ .env.';
  if (status === 429) return 'הגעתי למגבלת הקצב של ה-AI 😅 נסה שוב עוד רגע.';
  if (status === 400) return `ה-AI דחה את הבקשה: ${err?.message || 'שגיאה לא ידועה'}`;
  return 'משהו השתבש מול ה-AI. נסה שוב, ואם זה חוזר תבדוק את הלוג.';
}
