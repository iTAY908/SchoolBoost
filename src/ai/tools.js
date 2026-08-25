// הכלים שהסוכן יכול להפעיל על הנתונים של הבוט עצמו.
// כל כלי מקבל את הקלט מהמודל ומחזיר אובייקט שיוחזר אליו כ-tool_result.

import { DAY_NAMES, todayKey, addDays, weekdayOf, daysBetween, humanDate, zonedToEpoch } from '../time.js';
import { addHomework, openItems } from '../features/homework.js';
import { addExam, upcoming } from '../features/exams.js';
import { addGrade, summarize } from '../features/grades.js';
import { addReminder, pending } from '../features/reminders.js';
import { lessonsFor } from '../features/schedule.js';

const DATE_HINT = 'תאריך בפורמט YYYY-MM-DD';

export const TOOL_DEFS = [
  {
    name: 'get_agenda',
    description: 'סקירה של הימים הקרובים: שיעורים, מטלות להגשה ומבחנים. השתמש בזה כשנשאלת "מה יש לי היום/מחר/השבוע".',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'כמה ימים קדימה לכלול (1 = היום בלבד)', minimum: 1, maximum: 14 },
      },
      required: ['days'],
    },
  },
  {
    name: 'list_homework',
    description: 'רשימת שיעורי הבית. כברירת מחדל רק הפתוחים.',
    input_schema: {
      type: 'object',
      properties: {
        include_done: { type: 'boolean', description: 'לכלול גם מטלות שהושלמו' },
      },
    },
  },
  {
    name: 'add_homework',
    description: 'הוספת מטלה חדשה.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'שם המקצוע' },
        title: { type: 'string', description: 'מה צריך לעשות' },
        due: { type: 'string', description: `מועד ההגשה, ${DATE_HINT}. השמט אם אין תאריך.` },
      },
      required: ['subject', 'title'],
    },
  },
  {
    name: 'complete_homework',
    description: 'סימון מטלה כבוצעה לפי המזהה שלה (id מתוך list_homework).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    },
  },
  {
    name: 'list_exams',
    description: 'רשימת המבחנים הקרובים עם ספירה לאחור.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_exam',
    description: 'הוספת מבחן.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        date: { type: 'string', description: DATE_HINT },
        notes: { type: 'string', description: 'החומר למבחן' },
      },
      required: ['subject', 'date'],
    },
  },
  {
    name: 'list_grades',
    description: 'כל הציונים עם ממוצע לפי מקצוע וממוצע כללי.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_grade',
    description: 'הוספת ציון.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        value: { type: 'number', description: 'ציון בין 0 ל-100' },
        note: { type: 'string', description: 'על מה הציון' },
      },
      required: ['subject', 'value'],
    },
  },
  {
    name: 'get_schedule',
    description: 'מערכת השעות. בלי פרמטר מחזיר את כל השבוע.',
    input_schema: {
      type: 'object',
      properties: {
        day: { type: 'integer', description: '0=ראשון ... 6=שבת', minimum: 0, maximum: 6 },
      },
    },
  },
  {
    name: 'set_schedule_day',
    description: 'קביעת מערכת השעות ליום שלם. מחליף את מה שהיה.',
    input_schema: {
      type: 'object',
      properties: {
        day: { type: 'integer', minimum: 0, maximum: 6, description: '0=ראשון ... 6=שבת' },
        lessons: {
          type: 'array',
          description: 'השיעורים לפי הסדר',
          items: {
            type: 'object',
            properties: {
              time: { type: 'string', description: 'שעת התחלה HH:MM, אפשר להשמיט' },
              subject: { type: 'string' },
            },
            required: ['subject'],
          },
        },
      },
      required: ['day', 'lessons'],
    },
  },
  {
    name: 'add_reminder',
    description: 'קביעת תזכורת שתישלח בטלגרם בזמן מדויק.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'על מה להזכיר' },
        date: { type: 'string', description: DATE_HINT },
        time: { type: 'string', description: 'שעה בפורמט HH:MM' },
      },
      required: ['text', 'date', 'time'],
    },
  },
  {
    name: 'list_reminders',
    description: 'התזכורות הממתינות.',
    input_schema: { type: 'object', properties: {} },
  },
];

/** בונה את מפת המבצעים עבור צ'אט מסוים. */
export function makeExecutors({ store, chatId, tz }) {
  const chat = () => store.chat(chatId);

  const homeworkView = (h) => ({
    id: h.id, subject: h.subject, title: h.title, due: h.due, done: !!h.done,
  });

  return {
    get_agenda({ days = 1 }) {
      const span = Math.min(Math.max(Number(days) || 1, 1), 14);
      const c = chat();
      const today = todayKey(tz);
      const out = [];

      for (let i = 0; i < span; i++) {
        const key = addDays(today, i);
        const dayIndex = weekdayOf(key);
        out.push({
          date: key,
          day_name: DAY_NAMES[dayIndex],
          human: humanDate(key, tz),
          lessons: lessonsFor(c, dayIndex),
          homework_due: openItems(c).filter((h) => h.due === key).map(homeworkView),
          exams: c.exams.filter((e) => e.date === key).map((e) => ({ subject: e.subject, notes: e.notes })),
        });
      }

      return {
        today,
        days: out,
        overdue: openItems(c)
          .filter((h) => h.due && daysBetween(today, h.due) < 0)
          .map(homeworkView),
      };
    },

    list_homework({ include_done = false } = {}) {
      const c = chat();
      const items = include_done ? c.homework : openItems(c);
      return { count: items.length, items: items.map(homeworkView) };
    },

    add_homework({ subject, title, due }) {
      if (!subject || !title) return { error: 'צריך גם מקצוע וגם תיאור המטלה' };
      const item = addHomework(store, chatId, { subject, title, due: due || null });
      return { created: homeworkView(item) };
    },

    complete_homework({ id }) {
      const item = chat().homework.find((h) => h.id === Number(id));
      if (!item) return { error: `לא נמצאה מטלה עם מזהה ${id}` };
      item.done = true;
      item.doneAt = Date.now();
      store.markDirty();
      return { completed: homeworkView(item) };
    },

    list_exams() {
      const c = chat();
      const today = todayKey(tz);
      return {
        exams: upcoming(c, tz).map((e) => ({
          id: e.id, subject: e.subject, date: e.date, notes: e.notes,
          days_away: daysBetween(today, e.date),
        })),
      };
    },

    add_exam({ subject, date, notes }) {
      if (!subject || !date) return { error: 'צריך מקצוע ותאריך' };
      const item = addExam(store, chatId, { subject, date, notes: notes || null });
      return { created: { id: item.id, subject: item.subject, date: item.date, notes: item.notes } };
    },

    list_grades() {
      const c = chat();
      const { subjects, overall } = summarize(c);
      return {
        overall_average: overall === null ? null : Number(overall.toFixed(2)),
        by_subject: subjects.map((s) => ({
          subject: s.subject, average: Number(s.average.toFixed(2)), count: s.count,
        })),
        grades: c.grades.map((g) => ({ id: g.id, subject: g.subject, value: g.value, note: g.note })),
      };
    },

    add_grade({ subject, value, note }) {
      const num = Number(value);
      if (!subject) return { error: 'צריך מקצוע' };
      if (!Number.isFinite(num) || num < 0 || num > 100) return { error: 'ציון חייב להיות בין 0 ל-100' };
      const item = addGrade(store, chatId, { subject, value: num, note: note || null });
      const { subjects } = summarize(chat());
      const avg = subjects.find((s) => s.subject === subject);
      return {
        created: { id: item.id, subject: item.subject, value: item.value },
        subject_average: avg ? Number(avg.average.toFixed(2)) : null,
      };
    },

    get_schedule({ day } = {}) {
      const c = chat();
      if (day === undefined || day === null) {
        const week = {};
        for (let d = 0; d < 7; d++) week[DAY_NAMES[d]] = lessonsFor(c, d);
        return { week, today: DAY_NAMES[weekdayOf(todayKey(tz))] };
      }
      const idx = Number(day);
      if (!Number.isInteger(idx) || idx < 0 || idx > 6) return { error: 'day חייב להיות בין 0 ל-6' };
      return { day: DAY_NAMES[idx], lessons: lessonsFor(c, idx) };
    },

    set_schedule_day({ day, lessons }) {
      const idx = Number(day);
      if (!Number.isInteger(idx) || idx < 0 || idx > 6) return { error: 'day חייב להיות בין 0 ל-6' };
      if (!Array.isArray(lessons)) return { error: 'lessons חייב להיות מערך' };
      const clean = lessons
        .filter((l) => l && l.subject)
        .map((l) => ({ time: l.time || null, subject: String(l.subject) }));
      chat().schedule[String(idx)] = clean;
      store.markDirty();
      return { day: DAY_NAMES[idx], lessons: clean };
    },

    add_reminder({ text, date, time }) {
      if (!text || !date || !time) return { error: 'צריך טקסט, תאריך ושעה' };
      const [y, m, d] = String(date).split('-').map(Number);
      const [hh, mi] = String(time).split(':').map(Number);
      if (![y, m, d, hh].every(Number.isFinite)) return { error: 'תאריך או שעה לא תקינים' };
      const at = zonedToEpoch(y, m, d, hh, Number.isFinite(mi) ? mi : 0, tz);
      if (at <= Date.now()) return { error: 'הזמן שביקשת כבר עבר' };
      const item = addReminder(store, chatId, { text, at });
      return { created: { id: item.id, text: item.text, at: new Date(at).toISOString() } };
    },

    list_reminders() {
      return {
        reminders: pending(chat()).map((r) => ({
          id: r.id, text: r.text, at: new Date(r.at).toISOString(),
        })),
      };
    },
  };
}
