import { esc, bold, italic, keyboard, BACK_ROW } from '../ui.js';
import { DAY_NAMES, todayKey, weekdayOf, addDays } from '../time.js';

/** מפרש שורות של "08:00 מתמטיקה" או "מתמטיקה" למערך שיעורים. */
export function parseLessons(text) {
  const lessons = [];
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^[-•*]\s*/, '');
    if (!trimmed) continue;
    const m = trimmed.match(/^(\d{1,2}[:.]\d{2})\s+(.+)$/);
    if (m) {
      lessons.push({ time: m[1].replace('.', ':'), subject: m[2].trim() });
    } else {
      lessons.push({ time: null, subject: trimmed });
    }
  }
  return lessons;
}

export function lessonsFor(chat, dayIndex) {
  return chat.schedule[String(dayIndex)] || chat.schedule[dayIndex] || [];
}

export function renderDay(chat, dayIndex, { title } = {}) {
  const lessons = lessonsFor(chat, dayIndex);
  const heading = title || `📅 יום ${DAY_NAMES[dayIndex]}`;
  const lines = [bold(heading), ''];

  if (!lessons.length) {
    lines.push(italic('אין שיעורים ביום הזה.'));
  } else {
    lessons.forEach((l, i) => {
      const prefix = l.time ? `🕐 ${esc(l.time)}` : `${i + 1}.`;
      lines.push(`${prefix}  ${bold(l.subject)}`);
    });
  }
  return lines.join('\n');
}

function renderWeek(chat, tz) {
  const today = weekdayOf(todayKey(tz));
  const lines = [bold('📅 מערכת השעות השבועית'), ''];

  for (let d = 0; d < 7; d++) {
    const lessons = lessonsFor(chat, d);
    if (!lessons.length && (d === 5 || d === 6)) continue; // מדלגים על סופ"ש ריק
    const marker = d === today ? ' ⬅️ היום' : '';
    lines.push(`${bold(`יום ${DAY_NAMES[d]}`)}${marker}`);
    if (!lessons.length) {
      lines.push(`   ${italic('—')}`);
    } else {
      for (const l of lessons) {
        lines.push(`   ${l.time ? `${esc(l.time)} · ` : ''}${esc(l.subject)}`);
      }
    }
    lines.push('');
  }

  const rows = [
    [['✏️ עריכת יום', 'sc:pick']],
    [['🗑 ניקוי יום', 'sc:clearpick']],
    [BACK_ROW],
  ];
  return { text: lines.join('\n').trim(), ...keyboard(rows) };
}

function dayPicker(prefix, title) {
  const rows = [];
  for (let i = 0; i < 7; i += 2) {
    const row = [[`יום ${DAY_NAMES[i]}`, `${prefix}:${i}`]];
    if (i + 1 < 7) row.push([`יום ${DAY_NAMES[i + 1]}`, `${prefix}:${i + 1}`]);
    rows.push(row);
  }
  rows.push([['⬅️ חזרה', 'sc:menu']]);
  return { text: title, ...keyboard(rows) };
}

export default {
  name: 'sc',

  commands: {
    '/week': (ctx) => ctx.render(renderWeek(ctx.chat, ctx.tz)),
    '/schedule': (ctx) => ctx.render(renderWeek(ctx.chat, ctx.tz)),
  },

  async onCallback(ctx, action, arg) {
    switch (action) {
      case 'menu':
        return ctx.render(renderWeek(ctx.chat, ctx.tz));

      case 'pick':
        return ctx.render(dayPicker('sc:edit', [bold('✏️ עריכת מערכת'), '', 'איזה יום לערוך?'].join('\n')));

      case 'clearpick':
        return ctx.render(dayPicker('sc:clear', [bold('🗑 ניקוי יום'), '', 'איזה יום לנקות?'].join('\n')));

      case 'edit': {
        const day = Number(arg);
        ctx.setState('sc:lessons', { day });
        await ctx.answer();
        return ctx.reply([
          bold(`✏️ מערכת ליום ${DAY_NAMES[day]}`),
          '',
          'שלח את השיעורים — שיעור בכל שורה:',
          '',
          '<code>08:00 מתמטיקה\n08:50 אנגלית\n09:45 היסטוריה</code>',
          '',
          italic('אפשר גם בלי שעות, רק שמות מקצועות לפי הסדר.'),
          italic('/cancel לביטול'),
        ].join('\n'));
      }

      case 'clear': {
        const day = Number(arg);
        ctx.chat.schedule[String(day)] = [];
        ctx.store.markDirty();
        await ctx.answer(`🗑 יום ${DAY_NAMES[day]} נוקה`);
        return ctx.render(renderWeek(ctx.chat, ctx.tz));
      }

      case 'today': {
        const d = weekdayOf(todayKey(ctx.tz));
        return ctx.render({ text: renderDay(ctx.chat, d, { title: `📅 היום — יום ${DAY_NAMES[d]}` }),
          ...keyboard([[['מחר ➡️', 'sc:tomorrow']], [['📅 כל השבוע', 'sc:menu']], [BACK_ROW]]) });
      }

      case 'tomorrow': {
        const d = weekdayOf(addDays(todayKey(ctx.tz), 1));
        return ctx.render({ text: renderDay(ctx.chat, d, { title: `📅 מחר — יום ${DAY_NAMES[d]}` }),
          ...keyboard([[['⬅️ היום', 'sc:today']], [['📅 כל השבוע', 'sc:menu']], [BACK_ROW]]) });
      }

      default:
        return ctx.answer();
    }
  },

  states: {
    'sc:lessons': (ctx) => {
      const { day } = ctx.state.data;
      const lessons = parseLessons(ctx.text);
      if (!lessons.length) return ctx.reply('לא זיהיתי שיעורים. שלח שיעור בכל שורה, למשל: <code>08:00 מתמטיקה</code>');
      ctx.chat.schedule[String(day)] = lessons;
      ctx.store.markDirty();
      ctx.clearState();
      return ctx.reply(
        [`✅ עודכנה המערכת ליום ${DAY_NAMES[day]}:`, '', renderDay(ctx.chat, day, { title: `יום ${DAY_NAMES[day]}` })].join('\n'),
        keyboard([[['📅 כל השבוע', 'sc:menu']], [BACK_ROW]]),
      );
    },
  },
};
