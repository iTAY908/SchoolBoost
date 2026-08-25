import { esc, bold, italic, keyboard, BACK_ROW } from '../ui.js';
import { parseDate, parseTime, humanDate, humanTime, zonedToEpoch } from '../time.js';

export function addReminder(store, chatId, { text, at }) {
  const chat = store.chat(chatId);
  const item = {
    id: store.nextId(chatId, 'reminders'),
    text,
    at,
    sent: false,
    createdAt: Date.now(),
  };
  chat.reminders.push(item);
  store.markDirty();
  return item;
}

export function pending(chat) {
  return chat.reminders.filter((r) => !r.sent).sort((a, b) => a.at - b.at);
}

/** מקבל "מחר 18:00" / "היום ב-20" ומחזיר חותמת זמן, או null. */
export function parseWhen(input, tz) {
  // "ב-18:00" / "בשעה 18:00" -> "18:00". שימו לב: \b של JS לא עובד על עברית.
  const raw = String(input || '').trim()
    .replace(/(^|\s)(?:ב-?|בשעה)\s*(?=\d)/g, '$1')
    .replace(/\s+/g, ' ');
  const tokens = raw.split(' ');

  for (let split = tokens.length - 1; split >= 1; split--) {
    const datePart = tokens.slice(0, split).join(' ');
    const timePart = tokens.slice(split).join(' ');
    const date = parseDate(datePart, tz);
    const time = parseTime(timePart);
    if (date && time) {
      const [y, m, d] = date.split('-').map(Number);
      return zonedToEpoch(y, m, d, time.hour, time.minute, tz);
    }
  }

  // רק שעה — מתייחסים להיום, ואם השעה כבר עברה אז למחר
  const onlyTime = parseTime(raw);
  if (onlyTime) {
    const today = parseDate('היום', tz);
    const [y, m, d] = today.split('-').map(Number);
    let at = zonedToEpoch(y, m, d, onlyTime.hour, onlyTime.minute, tz);
    if (at <= Date.now()) at += 86400000;
    return at;
  }

  // רק תאריך — ברירת מחדל 08:00
  const onlyDate = parseDate(raw, tz);
  if (onlyDate) {
    const [y, m, d] = onlyDate.split('-').map(Number);
    return zonedToEpoch(y, m, d, 8, 0, tz);
  }

  return null;
}

export function describe(at, tz) {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at);
  return `${humanDate(iso, tz)} בשעה ${humanTime(at, tz)}`;
}

export function renderList(chat, tz) {
  const items = pending(chat);
  const lines = [bold('⏰ תזכורות'), ''];

  if (!items.length) {
    lines.push(italic('אין תזכורות פעילות.'));
  } else {
    items.slice(0, 12).forEach((item, i) => {
      lines.push(`${i + 1}. ${esc(item.text)}`);
      lines.push(`    🕐 ${esc(describe(item.at, tz))}`);
    });
  }

  const rows = [[['➕ תזכורת חדשה', 'rm:add']]];
  const shown = items.slice(0, 12);
  for (let i = 0; i < shown.length; i += 3) {
    rows.push(shown.slice(i, i + 3).map((item, j) => [`🗑 ${i + j + 1}`, `rm:del:${item.id}`]));
  }
  rows.push([BACK_ROW]);

  return { text: lines.join('\n'), ...keyboard(rows) };
}

export default {
  name: 'rm',

  commands: {
    '/remind': (ctx) => {
      ctx.setState('rm:text', {});
      return ctx.reply([bold('⏰ תזכורת חדשה'), '', 'על מה להזכיר לך?', '', italic('/cancel לביטול')].join('\n'));
    },
    '/reminders': (ctx) => ctx.render(renderList(ctx.chat, ctx.tz)),
  },

  async onCallback(ctx, action, arg) {
    switch (action) {
      case 'menu':
        return ctx.render(renderList(ctx.chat, ctx.tz));

      case 'add':
        ctx.setState('rm:text', {});
        await ctx.answer();
        return ctx.reply([bold('⏰ תזכורת חדשה'), '', 'על מה להזכיר לך?', '', italic('/cancel לביטול')].join('\n'));

      case 'del': {
        const idx = ctx.chat.reminders.findIndex((r) => r.id === Number(arg));
        if (idx === -1) return ctx.answer('התזכורת כבר לא קיימת');
        ctx.chat.reminders.splice(idx, 1);
        ctx.store.markDirty();
        await ctx.answer('🗑 נמחקה');
        return ctx.render(renderList(ctx.chat, ctx.tz));
      }

      default:
        return ctx.answer();
    }
  },

  states: {
    'rm:text': (ctx) => {
      ctx.setState('rm:when', { text: ctx.text.trim() });
      return ctx.reply(['מתי להזכיר?', '', italic('למשל: מחר 18:00 · היום 20 · יום ראשון 7:30 · 12.6 16:45')].join('\n'));
    },

    'rm:when': (ctx) => {
      const at = parseWhen(ctx.text, ctx.tz);
      if (!at) return ctx.reply('לא הבנתי את הזמן 🤔 נסה למשל: "מחר 18:00".');
      if (at <= Date.now()) return ctx.reply('הזמן הזה כבר עבר ⏳ תן לי זמן עתידי.');
      const item = addReminder(ctx.store, ctx.chatId, { ...ctx.state.data, at });
      ctx.clearState();
      return ctx.reply(
        [`✅ אזכיר לך: ${bold(item.text)}`, `🕐 ${esc(describe(item.at, ctx.tz))}`].join('\n'),
        keyboard([[['⏰ לכל התזכורות', 'rm:menu']], [BACK_ROW]]),
      );
    },
  },
};
