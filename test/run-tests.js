import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeHarness, fakeTelegram } from './helpers.js';
import {
  parseDate, parseTime, addDays, daysBetween, weekdayOf, todayKey,
  zonedToEpoch, humanDate, isoKey,
} from '../src/time.js';
import { detect, splitTrailingDate } from '../src/quick.js';
import { parseLessons } from '../src/features/schedule.js';
import { summarize } from '../src/features/grades.js';
import { parseWhen } from '../src/features/reminders.js';
import { Scheduler } from '../src/scheduler.js';
import { Store } from '../src/storage.js';
import { buildDigest } from '../src/digest.js';

const TZ = 'Asia/Jerusalem';
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ── תאריכים וזמנים ───────────────────────────────────────────
test('parseDate מזהה ביטויים יחסיים', () => {
  const today = todayKey(TZ);
  assert.equal(parseDate('היום', TZ), today);
  assert.equal(parseDate('מחר', TZ), addDays(today, 1));
  assert.equal(parseDate('מחרתיים', TZ), addDays(today, 2));
  assert.equal(parseDate('בעוד 5 ימים', TZ), addDays(today, 5));
  assert.equal(parseDate('עוד 1 יום', TZ), addDays(today, 1));
});

test('parseDate מזהה שמות ימים ומקדם לשבוע הבא כשצריך', () => {
  const today = todayKey(TZ);
  const result = parseDate('יום שלישי', TZ);
  assert.ok(result, 'אמור להחזיר תאריך');
  assert.equal(weekdayOf(result), 2);
  const delta = daysBetween(today, result);
  assert.ok(delta >= 1 && delta <= 7, `הפרש לא הגיוני: ${delta}`);
});

test('parseDate מזהה פורמטים מספריים', () => {
  assert.equal(parseDate('2026-12-25', TZ), '2026-12-25');
  assert.equal(parseDate('25/12/2026', TZ), '2026-12-25');
  assert.equal(parseDate('25.12.26', TZ), '2026-12-25');
  assert.equal(parseDate('7/3/2027', TZ), '2027-03-07');
});

test('parseDate דוחה תאריכים לא חוקיים', () => {
  assert.equal(parseDate('32/13/2026', TZ), null);
  assert.equal(parseDate('31.02.2026', TZ), null);
  assert.equal(parseDate('בלה בלה', TZ), null);
  assert.equal(parseDate('', TZ), null);
});

test('parseTime מקבל HH:MM ו-HH בלבד', () => {
  assert.deepEqual(parseTime('7'), { hour: 7, minute: 0 });
  assert.deepEqual(parseTime('18:30'), { hour: 18, minute: 30 });
  assert.equal(parseTime('25:00'), null);
  assert.equal(parseTime('12:75'), null);
});

test('zonedToEpoch מדייק גם בשעון קיץ וגם בחורף', () => {
  // ישראל: UTC+3 בקיץ, UTC+2 בחורף
  assert.equal(zonedToEpoch(2026, 7, 15, 12, 0, TZ), Date.UTC(2026, 6, 15, 9, 0));
  assert.equal(zonedToEpoch(2026, 1, 15, 12, 0, TZ), Date.UTC(2026, 0, 15, 10, 0));
});

test('addDays ו-daysBetween חוצים גבולות חודש ושנה', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-02-27', '2026-03-01'), 2);
  assert.equal(isoKey(2026, 3, 7), '2026-03-07');
});

test('humanDate מציג "היום" ו"מחר"', () => {
  const today = todayKey(TZ);
  assert.match(humanDate(today, TZ), /^היום/);
  assert.match(humanDate(addDays(today, 1), TZ), /^מחר/);
});

// ── פענוח כתיבה חופשית ──────────────────────────────────────
test('splitTrailingDate מפריד תאריך מסוף המשפט', () => {
  const { rest, due } = splitTrailingDate('תרגילים 4-7 מחר', TZ);
  assert.equal(rest, 'תרגילים 4-7');
  assert.equal(due, addDays(todayKey(TZ), 1));
});

test('detect מזהה שיעורי בית', () => {
  const intent = detect('שיעורי בית מתמטיקה תרגילים 4-7 מחר', TZ);
  assert.equal(intent.kind, 'homework');
  assert.equal(intent.subject, 'מתמטיקה');
  assert.equal(intent.title, 'תרגילים 4-7');
  assert.equal(intent.due, addDays(todayKey(TZ), 1));
});

test('detect מזהה מבחן עם תאריך', () => {
  const intent = detect('מבחן אנגלית 12.6', TZ);
  assert.equal(intent.kind, 'exam');
  assert.equal(intent.subject, 'אנגלית');
  assert.match(intent.date, /-06-12$/);
});

test('detect מזהה ציון', () => {
  const intent = detect('ציון 95 בהיסטוריה', TZ);
  assert.equal(intent.kind, 'grade');
  assert.equal(intent.value, 95);
  assert.equal(intent.subject, 'היסטוריה');
});

test('detect מזהה תזכורת עם זמן מלא', () => {
  const intent = detect('תזכיר לי מחר ב-18:00 להביא ציוד ספורט', TZ);
  assert.equal(intent.kind, 'reminder');
  assert.equal(intent.text, 'להביא ציוד ספורט');
  assert.ok(intent.at > Date.now());
});

test('detect מחזיר reminder-partial כשאין זמן', () => {
  const intent = detect('תזכיר לי להחזיר ספר לספרייה', TZ);
  assert.equal(intent.kind, 'reminder-partial');
});

test('detect מחזיר null לטקסט לא מזוהה', () => {
  assert.equal(detect('מה שלומך', TZ), null);
  assert.equal(detect('', TZ), null);
});

test('parseWhen מטפל בשעה בלבד ומקדם למחר אם עברה', () => {
  const at = parseWhen('00:01', TZ);
  assert.ok(at > Date.now(), 'זמן שעבר היום צריך להתגלגל למחר');
});

// ── מערכת שעות ──────────────────────────────────────────────
test('parseLessons קורא שורות עם ובלי שעות', () => {
  const lessons = parseLessons('08:00 מתמטיקה\n- אנגלית\n09.45 היסטוריה\n\n');
  assert.equal(lessons.length, 3);
  assert.deepEqual(lessons[0], { time: '08:00', subject: 'מתמטיקה' });
  assert.deepEqual(lessons[1], { time: null, subject: 'אנגלית' });
  assert.equal(lessons[2].time, '09:45');
});

// ── ציונים ─────────────────────────────────────────────────
test('summarize מחשב ממוצע משוקלל', () => {
  const chat = { grades: [
    { subject: 'מתמטיקה', value: 90, weight: 1 },
    { subject: 'מתמטיקה', value: 100, weight: 3 },
    { subject: 'אנגלית', value: 80, weight: 1 },
  ] };
  const { subjects, overall } = summarize(chat);
  const math = subjects.find((s) => s.subject === 'מתמטיקה');
  assert.equal(math.average, 97.5);
  assert.equal(math.count, 2);
  assert.equal(overall, (90 + 300 + 80) / 5);
});

// ── זרימות מלאות דרך הראוטר ─────────────────────────────────
test('/start מחזיר ברכה ותפריט', async () => {
  const h = makeHarness();
  await h.send('/start');
  assert.match(h.tg.last(), /SchoolBoost/);
  assert.match(h.tg.last(), /איתי/);
  const kb = h.tg.calls.at(-1).payload.reply_markup;
  assert.ok(kb.inline_keyboard.length >= 3);
  h.cleanup();
});

test('פקודה לא מוכרת לא מפילה את הבוט', async () => {
  const h = makeHarness();
  await h.send('/whatever');
  assert.match(h.tg.last(), /לא מכיר את הפקודה/);
  h.cleanup();
});

test('זרימת הוספת שיעורי בית מהתפריט', async () => {
  const h = makeHarness();
  await h.click('hw:add');
  await h.send('פיזיקה');
  await h.send('לסכם פרק 3');
  await h.send('מחר');
  const items = h.chat().homework;
  assert.equal(items.length, 1);
  assert.equal(items[0].subject, 'פיזיקה');
  assert.equal(items[0].title, 'לסכם פרק 3');
  assert.equal(items[0].due, addDays(todayKey(TZ), 1));
  assert.match(h.tg.last(), /נוספה מטלה/);
  h.cleanup();
});

test('תאריך לא תקין בזרימה מבקש קלט מחדש ולא מאבד את השיחה', async () => {
  const h = makeHarness();
  await h.click('hw:add');
  await h.send('כימיה');
  await h.send('דוח מעבדה');
  await h.send('בלגן');
  assert.match(h.tg.last(), /לא הצלחתי להבין את התאריך/);
  assert.equal(h.chat().homework.length, 0);
  await h.send('מחר');
  assert.equal(h.chat().homework.length, 1);
  h.cleanup();
});

test('/cancel עוצר זרימה באמצע', async () => {
  const h = makeHarness();
  await h.click('hw:add');
  await h.send('/cancel');
  assert.match(h.tg.last(), /בוטל/);
  await h.send('סתם טקסט');
  assert.equal(h.chat().homework.length, 0);
  h.cleanup();
});

test('סימון מטלה כבוצעה ומחיקתה', async () => {
  const h = makeHarness();
  await h.send('שיעורי בית תנך לקרוא פרק ב מחר');
  const id = h.chat().homework[0].id;
  await h.click(`hw:done:${id}`);
  assert.equal(h.chat().homework[0].done, true);
  await h.click(`hw:del:${id}`);
  assert.equal(h.chat().homework.length, 0);
  h.cleanup();
});

test('לחיצה על מטלה שנמחקה לא זורקת שגיאה', async () => {
  const h = makeHarness();
  await h.click('hw:done:9999');
  const answer = h.tg.calls.filter((c) => c.method === 'answerCallbackQuery').at(-1);
  assert.match(answer.payload.text, /כבר לא קיימת/);
  h.cleanup();
});

test('הוספת מבחן וציון בכתיבה חופשית', async () => {
  const h = makeHarness();
  await h.send('מבחן ביולוגיה בעוד 10 ימים');
  await h.send('ציון 88 בביולוגיה');
  assert.equal(h.chat().exams.length, 1);
  assert.equal(h.chat().exams[0].date, addDays(todayKey(TZ), 10));
  assert.equal(h.chat().grades[0].value, 88);
  h.cleanup();
});

test('עריכת מערכת שעות ליום מסוים', async () => {
  const h = makeHarness();
  await h.click('sc:edit:1');
  await h.send('08:00 מתמטיקה\n08:50 אנגלית');
  assert.equal(h.chat().schedule['1'].length, 2);
  await h.click('sc:clear:1');
  assert.equal(h.chat().schedule['1'].length, 0);
  h.cleanup();
});

test('טקסט חופשי לא מזוהה מחזיר הכוונה ולא נופל', async () => {
  const h = makeHarness();
  await h.send('היי מה נשמע');
  assert.match(h.tg.last(), /לא בטוח מה לעשות/);
  h.cleanup();
});

test('כל כפתורי התפריט הראשי מגיבים', async () => {
  const h = makeHarness();
  for (const data of ['sc:menu', 'hw:menu', 'ex:menu', 'gr:menu', 'rm:menu', 'st:menu', 'core:today', 'core:menu']) {
    h.tg.reset();
    await h.click(data);
    assert.ok(h.tg.outgoing().length > 0, `הכפתור ${data} לא החזיר תשובה`);
  }
  h.cleanup();
});

test('תוכן מהמשתמש עובר escaping ל-HTML', async () => {
  const h = makeHarness();
  await h.send('ציון 90 ב<b>זריקה</b>');
  h.tg.reset();
  await h.click('gr:menu');
  const text = h.tg.last();
  assert.ok(text.includes('&lt;b&gt;'), 'תגיות HTML מהמשתמש חייבות להיות מנוטרלות');
  h.cleanup();
});

// ── התמדה ──────────────────────────────────────────────────
test('נתונים נשמרים ונטענים מחדש מהדיסק', async () => {
  const h = makeHarness();
  await h.send('שיעורי בית ספרות חיבור על ביאליק מחר');
  h.store.flush();
  const reloaded = new Store(h.file, TZ);
  assert.equal(reloaded.chat(h.chatId).homework.length, 1);
  assert.equal(reloaded.chat(h.chatId).homework[0].subject, 'ספרות');
  reloaded.close();
  h.cleanup();
});

test('קובץ נתונים פגום לא מפיל את הבוט', () => {
  const h = makeHarness();
  h.store.close();
  writeFileSync(h.file, '{ this is not json', 'utf8');
  const store = new Store(h.file, TZ);
  assert.deepEqual(store.chatIds(), []);
  store.close();
  h.cleanup();
});

// ── מתזמן ──────────────────────────────────────────────────
test('המתזמן שולח תזכורת שהגיע זמנה, פעם אחת בלבד', async () => {
  const h = makeHarness();
  const chat = h.chat();
  chat.reminders.push({ id: 1, text: 'להביא ציוד ספורט', at: Date.now() - 1000, sent: false });
  chat.settings.digestEnabled = false;
  h.store.markDirty();

  const scheduler = new Scheduler({ tg: h.tg, store: h.store, tz: TZ });
  h.tg.reset();
  const first = await scheduler.tick();
  assert.equal(first, 1);
  assert.match(h.tg.last(), /להביא ציוד ספורט/);

  h.tg.reset();
  const second = await scheduler.tick();
  assert.equal(second, 0, 'תזכורת לא אמורה להישלח פעמיים');
  h.cleanup();
});

test('המתזמן לא שולח תזכורת עתידית', async () => {
  const h = makeHarness();
  const chat = h.chat();
  chat.reminders.push({ id: 1, text: 'מאוחר יותר', at: Date.now() + 3600_000, sent: false });
  chat.settings.digestEnabled = false;
  const scheduler = new Scheduler({ tg: h.tg, store: h.store, tz: TZ });
  h.tg.reset();
  assert.equal(await scheduler.tick(), 0);
  h.cleanup();
});

test('הסיכום היומי נשלח פעם ביום בשעה שנקבעה', async () => {
  const h = makeHarness();
  const chat = h.chat();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false })
    .format(new Date()));
  chat.settings.digestHour = hour;
  chat.settings.digestEnabled = true;
  chat.schedule[String(weekdayOf(todayKey(TZ)))] = [{ time: '08:00', subject: 'מתמטיקה' }];
  h.store.markDirty();

  const scheduler = new Scheduler({ tg: h.tg, store: h.store, tz: TZ });
  h.tg.reset();
  assert.equal(await scheduler.tick(), 1);
  assert.match(h.tg.last(), /מתמטיקה/);
  assert.equal(await scheduler.tick(), 0, 'הסיכום לא אמור לחזור על עצמו באותו יום');
  h.cleanup();
});

test('המתזמן מפסיק לשלוח לצ׳אט שחסם את הבוט', async () => {
  const h = makeHarness();
  const chat = h.chat();
  chat.reminders.push({ id: 1, text: 'בדיקה', at: Date.now() - 1000, sent: false });
  chat.settings.digestEnabled = false;

  h.tg.call = async () => {
    const err = new Error('blocked');
    err.code = 403;
    throw err;
  };
  const scheduler = new Scheduler({ tg: h.tg, store: h.store, tz: TZ });
  assert.equal(await scheduler.tick(), 0);
  assert.equal(h.chat().blocked, true);
  h.cleanup();
});

// ── סיכום יומי ─────────────────────────────────────────────
test('buildDigest כולל שיעורים, מטלות ומבחנים', () => {
  const h = makeHarness();
  const chat = h.chat();
  const today = todayKey(TZ);
  chat.schedule[String(weekdayOf(today))] = [{ time: '08:00', subject: 'מתמטיקה' }];
  chat.homework.push({ id: 1, subject: 'אנגלית', title: 'עבודה', due: today, done: false });
  chat.exams.push({ id: 1, subject: 'פיזיקה', date: addDays(today, 3) });

  const text = buildDigest(chat, TZ);
  assert.match(text, /מתמטיקה/);
  assert.match(text, /אנגלית/);
  assert.match(text, /פיזיקה/);
  h.cleanup();
});

// ── לקוח טלגרם ─────────────────────────────────────────────
test('לקוח טלגרם חותך הודעות ארוכות מדי', async () => {
  const tg = fakeTelegram();
  await tg.sendMessage(1, 'א'.repeat(5000));
  assert.equal(tg.calls.at(-1).payload.text.length, 4096);
});

test('polling ממשיך אחרי שגיאת רשת חולפת', async () => {
  let attempt = 0;
  const tg = fakeTelegram();
  const received = [];
  tg.call = async (method) => {
    if (method !== 'getUpdates') return true;
    attempt += 1;
    if (attempt === 1) throw new Error('ECONNRESET');
    if (attempt === 2) return [{ update_id: 5, message: { text: 'שלום' } }];
    tg.stop();
    return [];
  };
  await tg.startPolling((u) => received.push(u));
  assert.equal(received.length, 1);
  assert.equal(tg.offset, 6);
});

// ── הרצה ───────────────────────────────────────────────────
let passed = 0;
const failures = [];

for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message.split('\n')[0]}`);
  }
}

console.log(`\n${passed}/${tests.length} בדיקות עברו`);
if (failures.length) {
  console.log('\nכשלונות:');
  for (const f of failures) console.log(`\n— ${f.name}\n${f.err.stack}`);
  process.exit(1);
}
