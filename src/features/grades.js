import { esc, bold, italic, keyboard, BACK_ROW } from '../ui.js';

export function addGrade(store, chatId, { subject, value, weight = 1, note = null }) {
  const chat = store.chat(chatId);
  const item = {
    id: store.nextId(chatId, 'grades'),
    subject,
    value,
    weight,
    note,
    at: Date.now(),
  };
  chat.grades.push(item);
  store.markDirty();
  return item;
}

/** ממוצע משוקלל לפי מקצוע + ממוצע כללי. */
export function summarize(chat) {
  const bySubject = new Map();
  let totalSum = 0;
  let totalWeight = 0;

  for (const g of chat.grades) {
    const w = g.weight > 0 ? g.weight : 1;
    const entry = bySubject.get(g.subject) || { sum: 0, weight: 0, count: 0 };
    entry.sum += g.value * w;
    entry.weight += w;
    entry.count += 1;
    bySubject.set(g.subject, entry);
    totalSum += g.value * w;
    totalWeight += w;
  }

  const subjects = [...bySubject.entries()]
    .map(([subject, e]) => ({ subject, average: e.sum / e.weight, count: e.count }))
    .sort((a, b) => b.average - a.average);

  return { subjects, overall: totalWeight ? totalSum / totalWeight : null, count: chat.grades.length };
}

function medal(avg) {
  if (avg >= 95) return '🥇';
  if (avg >= 85) return '🥈';
  if (avg >= 75) return '🥉';
  if (avg >= 55) return '📗';
  return '📕';
}

export function renderList(chat) {
  const { subjects, overall, count } = summarize(chat);
  const lines = [bold('💯 ציונים'), ''];

  if (!count) {
    lines.push(italic('עוד לא הוספת ציונים.'));
  } else {
    lines.push(`ממוצע כללי: ${bold(overall.toFixed(1))}`, '');
    for (const s of subjects) {
      lines.push(`${medal(s.average)} ${bold(s.subject)} — ${s.average.toFixed(1)} ${italic(`(${s.count})`)}`);
    }
    const recent = chat.grades.slice(-5).reverse();
    lines.push('', bold('אחרונים:'));
    for (const g of recent) {
      lines.push(`• ${esc(g.subject)}: ${g.value}${g.note ? ` — ${esc(g.note)}` : ''}`);
    }
  }

  const rows = [[['➕ ציון חדש', 'gr:add']]];
  if (count) rows.push([['🗑 מחיקת הציון האחרון', 'gr:undo']]);
  rows.push([BACK_ROW]);

  return { text: lines.join('\n'), ...keyboard(rows) };
}

export default {
  name: 'gr',

  commands: {
    '/grades': (ctx) => ctx.render(renderList(ctx.chat)),
  },

  async onCallback(ctx, action) {
    switch (action) {
      case 'menu':
        return ctx.render(renderList(ctx.chat));

      case 'add':
        ctx.setState('gr:subject', {});
        await ctx.answer();
        return ctx.reply([bold('➕ ציון חדש'), '', 'באיזה מקצוע?', '', italic('/cancel לביטול')].join('\n'));

      case 'undo': {
        if (!ctx.chat.grades.length) return ctx.answer('אין מה למחוק');
        const removed = ctx.chat.grades.pop();
        ctx.store.markDirty();
        await ctx.answer(`🗑 ${removed.subject}: ${removed.value}`);
        return ctx.render(renderList(ctx.chat));
      }

      default:
        return ctx.answer();
    }
  },

  states: {
    'gr:subject': (ctx) => {
      ctx.setState('gr:value', { subject: ctx.text.trim() });
      return ctx.reply('מה הציון? (0-100)');
    },

    'gr:value': (ctx) => {
      const value = Number(ctx.text.trim().replace(',', '.'));
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return ctx.reply('צריך מספר בין 0 ל-100. נסה שוב:');
      }
      const item = addGrade(ctx.store, ctx.chatId, { ...ctx.state.data, value });
      ctx.clearState();
      const { subjects } = summarize(ctx.chat);
      const subjectAvg = subjects.find((s) => s.subject === item.subject);
      return ctx.reply(
        [
          `✅ נשמר: ${bold(item.subject)} — ${item.value}`,
          subjectAvg ? `ממוצע במקצוע: ${bold(subjectAvg.average.toFixed(1))}` : '',
        ].filter(Boolean).join('\n'),
        keyboard([[['💯 לכל הציונים', 'gr:menu']], [BACK_ROW]]),
      );
    },
  },
};
