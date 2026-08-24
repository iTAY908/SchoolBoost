import { esc, bold, italic, keyboard, BACK_ROW } from '../ui.js';
import { parseDate, humanDate, todayKey, daysBetween } from '../time.js';

const MAX_LIST = 12;

export function upcoming(chat, tz) {
  const today = todayKey(tz);
  return chat.exams
    .filter((e) => daysBetween(today, e.date) >= 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function addExam(store, chatId, { subject, date, notes }) {
  const chat = store.chat(chatId);
  const item = {
    id: store.nextId(chatId, 'exams'),
    subject,
    date,
    notes: notes || null,
    createdAt: Date.now(),
  };
  chat.exams.push(item);
  store.markDirty();
  return item;
}

export function countdown(date, tz) {
  const diff = daysBetween(todayKey(tz), date);
  if (diff === 0) return '🔥 היום!';
  if (diff === 1) return '⚠️ מחר!';
  if (diff <= 3) return `⏳ בעוד ${diff} ימים`;
  if (diff <= 7) return `🗓 בעוד ${diff} ימים`;
  return `בעוד ${diff} ימים`;
}

export function renderList(chat, tz) {
  const items = upcoming(chat, tz);
  const lines = [bold('🎯 מבחנים קרובים'), ''];

  if (!items.length) {
    lines.push(italic('אין מבחנים בהמתנה. תיהנה מהשקט 😌'));
  } else {
    items.slice(0, MAX_LIST).forEach((item, i) => {
      lines.push(`${i + 1}. ${bold(item.subject)} — ${esc(humanDate(item.date, tz))}`);
      lines.push(`    ${esc(countdown(item.date, tz))}${item.notes ? ` · ${esc(item.notes)}` : ''}`);
    });
  }

  const rows = [[['➕ מבחן חדש', 'ex:add']]];
  const shown = items.slice(0, MAX_LIST);
  if (shown.length) {
    for (let i = 0; i < shown.length; i += 3) {
      rows.push(shown.slice(i, i + 3).map((item, j) => [`🗑 ${i + j + 1}`, `ex:del:${item.id}`]));
    }
  }
  rows.push([BACK_ROW]);

  return { text: lines.join('\n'), ...keyboard(rows) };
}

export default {
  name: 'ex',

  commands: {
    '/exams': (ctx) => ctx.render(renderList(ctx.chat, ctx.tz)),
  },

  async onCallback(ctx, action, arg) {
    switch (action) {
      case 'menu':
        return ctx.render(renderList(ctx.chat, ctx.tz));

      case 'add':
        ctx.setState('ex:subject', {});
        await ctx.answer();
        return ctx.reply(
          [bold('➕ מבחן חדש'), '', 'באיזה מקצוע המבחן?', '', italic('/cancel לביטול')].join('\n'),
        );

      case 'del': {
        const idx = ctx.chat.exams.findIndex((e) => e.id === Number(arg));
        if (idx === -1) return ctx.answer('המבחן כבר לא קיים');
        const [removed] = ctx.chat.exams.splice(idx, 1);
        ctx.store.markDirty();
        await ctx.answer(`🗑 נמחק: ${removed.subject}`);
        return ctx.render(renderList(ctx.chat, ctx.tz));
      }

      default:
        return ctx.answer();
    }
  },

  states: {
    'ex:subject': (ctx) => {
      ctx.setState('ex:date', { subject: ctx.text.trim() });
      return ctx.reply(['מתי המבחן?', '', italic('למשל: יום שלישי · 12.6 · בעוד 10 ימים')].join('\n'));
    },

    'ex:date': (ctx) => {
      const date = parseDate(ctx.text.trim(), ctx.tz);
      if (!date) return ctx.reply('לא זיהיתי את התאריך 🤔 נסה: 12.6 או "יום שלישי".');
      ctx.setState('ex:notes', { ...ctx.state.data, date });
      return ctx.reply(['מה החומר למבחן? (אפשר לכתוב "דלג")'].join('\n'));
    },

    'ex:notes': (ctx) => {
      const raw = ctx.text.trim();
      const notes = /^(דלג|בלי|אין|-)$/.test(raw) ? null : raw;
      const item = addExam(ctx.store, ctx.chatId, { ...ctx.state.data, notes });
      ctx.clearState();
      return ctx.reply(
        [
          '✅ נוסף מבחן:',
          `${bold(item.subject)} — ${esc(humanDate(item.date, ctx.tz))}`,
          esc(countdown(item.date, ctx.tz)),
          item.notes ? `📚 ${esc(item.notes)}` : '',
        ].filter(Boolean).join('\n'),
        keyboard([[['🎯 לרשימת המבחנים', 'ex:menu']], [BACK_ROW]]),
      );
    },
  },
};
