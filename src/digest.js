import { esc, bold, italic, keyboard, BACK_ROW } from './ui.js';
import { DAY_NAMES, todayKey, weekdayOf, daysBetween, humanDate } from './time.js';
import { lessonsFor } from './features/schedule.js';
import { openItems } from './features/homework.js';
import { upcoming, countdown } from './features/exams.js';

const GREETINGS = [
  'בוקר טוב ☀️',
  'יום טוב! 🌤',
  'קדימה ליום חדש 💪',
  'בוקר אור 🌅',
];

/** בונה את הסיכום היומי. `greeting` נכבה כשמדובר בבקשה יזומה מהתפריט. */
export function buildDigest(chat, tz, { greeting = true } = {}) {
  const today = todayKey(tz);
  const dayIndex = weekdayOf(today);
  const lines = [];

  if (greeting) {
    lines.push(bold(GREETINGS[dayIndex % GREETINGS.length]));
    lines.push('');
  }
  lines.push(bold(`📅 יום ${DAY_NAMES[dayIndex]}, ${esc(humanDate(today, tz).replace(/^היום \(|\)$/g, ''))}`));
  lines.push('');

  // מערכת שעות
  const lessons = lessonsFor(chat, dayIndex);
  lines.push(bold('שיעורים היום'));
  if (!lessons.length) {
    lines.push(italic(dayIndex === 5 || dayIndex === 6 ? 'סוף שבוע — אין שיעורים 🎉' : 'לא הוגדרו שיעורים ליום הזה.'));
  } else {
    for (const l of lessons) {
      lines.push(`${l.time ? `🕐 ${esc(l.time)}  ` : '• '}${esc(l.subject)}`);
    }
  }
  lines.push('');

  // שיעורי בית
  const hw = openItems(chat);
  const dueToday = hw.filter((h) => h.due && daysBetween(today, h.due) <= 0);
  const dueSoon = hw.filter((h) => h.due && daysBetween(today, h.due) > 0 && daysBetween(today, h.due) <= 3);

  lines.push(bold('📝 שיעורי בית'));
  if (!hw.length) {
    lines.push(italic('אין מטלות פתוחות 🎉'));
  } else {
    if (dueToday.length) {
      for (const h of dueToday) {
        const late = daysBetween(today, h.due) < 0 ? ' (באיחור)' : '';
        lines.push(`🔴 ${bold(h.subject)} — ${esc(h.title)}${esc(late)}`);
      }
    }
    for (const h of dueSoon) {
      lines.push(`🟠 ${bold(h.subject)} — ${esc(h.title)} · ${esc(humanDate(h.due, tz))}`);
    }
    if (!dueToday.length && !dueSoon.length) {
      lines.push(italic(`אין מטלות דחופות (${hw.length} פתוחות בסך הכול).`));
    }
  }
  lines.push('');

  // מבחנים
  const exams = upcoming(chat, tz).filter((e) => daysBetween(today, e.date) <= 14);
  lines.push(bold('🎯 מבחנים קרובים'));
  if (!exams.length) {
    lines.push(italic('אין מבחנים בשבועיים הקרובים.'));
  } else {
    for (const e of exams.slice(0, 5)) {
      lines.push(`• ${bold(e.subject)} — ${esc(countdown(e.date, tz))}`);
    }
  }

  return lines.join('\n');
}

export function renderToday(chat, tz, opts) {
  return {
    text: buildDigest(chat, tz, opts),
    ...keyboard([
      [['📝 מטלות', 'hw:menu'], ['🎯 מבחנים', 'ex:menu']],
      [['📅 מחר', 'sc:tomorrow']],
      [BACK_ROW],
    ]),
  };
}
