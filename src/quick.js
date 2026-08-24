// קיצורי דרך בכתיבה חופשית: הופך משפט בעברית לפעולה בבוט.

import { parseDate } from './time.js';
import { addHomework } from './features/homework.js';
import { addExam } from './features/exams.js';
import { addGrade } from './features/grades.js';
import { addReminder, parseWhen } from './features/reminders.js';

const DAY_WORD = '(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)';
const DATE_RE = new RegExp(
  `(?:היום|מחר|מחרתיים|(?:בעוד|עוד)\\s+\\d{1,3}\\s*(?:ימים|יום)|(?:ביום|יום)\\s+${DAY_WORD}|` +
  `\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?)`,
);

/** מוציא ביטוי תאריך מסוף המשפט ומחזיר {rest, due}. */
export function splitTrailingDate(text, tz) {
  const trimmed = text.trim();
  const tail = new RegExp(`\\s+(?:ל|עד\\s+|ב)?(${DATE_RE.source})\\s*$`);
  const m = trimmed.match(tail);
  if (!m) return { rest: trimmed, due: null };
  const due = parseDate(m[1], tz);
  if (!due) return { rest: trimmed, due: null };
  return { rest: trimmed.slice(0, m.index).trim(), due };
}

/**
 * מנסה לזהות כוונה בטקסט חופשי.
 * מחזיר תיאור הפעולה, או null אם אין התאמה.
 */
export function detect(text, tz) {
  const s = text.trim().replace(/\s+/g, ' ');
  if (!s) return null;

  // תזכורת: "תזכיר לי מחר ב-18:00 להביא ציוד"
  const remind = s.match(/^(?:תזכיר\s+לי|תזכורת|הזכר\s+לי)\s+(.+)$/);
  if (remind) {
    const body = remind[1];
    const when = body.match(
      new RegExp(`^((?:${DATE_RE.source})?\\s*(?:ב-?\\s*)?\\d{1,2}(?::\\d{2})?|(?:${DATE_RE.source}))\\s+(.+)$`),
    );
    if (when) {
      const at = parseWhen(when[1], tz);
      if (at) return { kind: 'reminder', text: when[2].trim(), at };
    }
    return { kind: 'reminder-partial', text: body };
  }

  // מבחן: "מבחן אנגלית 12.6"
  const exam = s.match(/^(?:מבחן|בוחן|מבחנים)\s+(.+)$/);
  if (exam) {
    const { rest, due } = splitTrailingDate(exam[1], tz);
    if (due && rest) return { kind: 'exam', subject: rest, date: due };
    return null;
  }

  // ציון: "ציון 95 בהיסטוריה"
  const grade = s.match(/^(?:ציון|קיבלתי)\s+(\d{1,3}(?:[.,]\d)?)\s*(?:ב-?\s*)?(.+)$/);
  if (grade) {
    const value = Number(grade[1].replace(',', '.'));
    const subject = grade[2].trim();
    if (Number.isFinite(value) && value >= 0 && value <= 100 && subject) {
      return { kind: 'grade', value, subject };
    }
    return null;
  }

  // שיעורי בית: "שיעורי בית מתמטיקה תרגילים 4-7 מחר"
  const hw = s.match(/^(?:שיעורי\s+בית|שיעו"ב|שיע"ב|מטלה|להגיש)\s+(.+)$/);
  if (hw) {
    const { rest, due } = splitTrailingDate(hw[1], tz);
    const parts = rest.split(/[:،,]\s*|\s+/);
    if (!parts.length || !rest) return null;
    const subject = parts[0];
    const title = rest.slice(subject.length).replace(/^[\s:,-]+/, '').trim() || 'מטלה';
    return { kind: 'homework', subject, title, due };
  }

  return null;
}

/** מבצע את הכוונה שזוהתה ומחזיר טקסט אישור, או null אם לא זוהתה. */
export function apply(intent, ctx) {
  if (!intent) return null;

  switch (intent.kind) {
    case 'reminder': {
      if (intent.at <= Date.now()) return { text: 'הזמן הזה כבר עבר ⏳ נסה זמן עתידי.' };
      const item = addReminder(ctx.store, ctx.chatId, { text: intent.text, at: intent.at });
      return { kind: 'reminder', item };
    }
    case 'exam': {
      const item = addExam(ctx.store, ctx.chatId, { subject: intent.subject, date: intent.date });
      return { kind: 'exam', item };
    }
    case 'grade': {
      const item = addGrade(ctx.store, ctx.chatId, { subject: intent.subject, value: intent.value });
      return { kind: 'grade', item };
    }
    case 'homework': {
      const item = addHomework(ctx.store, ctx.chatId, intent);
      return { kind: 'homework', item };
    }
    default:
      return null;
  }
}
