// עבודה עם תאריכים ושעות באזור זמן נתון, בלי תלויות חיצוניות.

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partsIn(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return {
    year: +map.year,
    month: +map.month,
    day: +map.day,
    hour: +map.hour % 24,
    minute: +map.minute,
    second: +map.second,
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  };
}

/** הפרש בין אזור הזמן ל-UTC ברגע נתון, במילישניות. */
function offsetMs(date, tz) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** ממיר שעה מקומית באזור הזמן לחותמת זמן אבסולוטית (epoch ms). */
export function zonedToEpoch(y, m, d, hh = 0, mi = 0, tz = 'UTC') {
  const naive = Date.UTC(y, m - 1, d, hh, mi, 0);
  let guess = naive - offsetMs(new Date(naive), tz);
  // עידון נוסף לטיפול במעברי שעון קיץ
  guess = naive - offsetMs(new Date(guess), tz);
  return guess;
}

/** מחזיר את "עכשיו" כרכיבים באזור הזמן. */
export function now(tz) {
  return partsIn(new Date(), tz);
}

/** מפתח תאריך בפורמט YYYY-MM-DD עבור רגע נתון באזור הזמן. */
export function dateKey(date, tz) {
  const p = partsIn(date, tz);
  return isoKey(p.year, p.month, p.day);
}

export function isoKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function todayKey(tz) {
  return dateKey(new Date(), tz);
}

/** מוסיף ימים למפתח תאריך ומחזיר מפתח חדש. */
export function addDays(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** מספר הימים בין שני מפתחות תאריך (b - a). */
export function daysBetween(a, b) {
  const toUtc = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

/** אינדקס יום בשבוע (0=ראשון) עבור מפתח תאריך. */
export function weekdayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** תצוגה ידידותית: "היום", "מחר", או "יום שלישי, 12/05". */
export function humanDate(key, tz) {
  const diff = daysBetween(todayKey(tz), key);
  const [, m, d] = key.split('-').map(Number);
  const short = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  if (diff === 0) return `היום (${short})`;
  if (diff === 1) return `מחר (${short})`;
  if (diff === 2) return `מחרתיים (${short})`;
  if (diff === -1) return `אתמול (${short})`;
  return `יום ${DAY_NAMES[weekdayOf(key)]}, ${short}`;
}

export function humanTime(epochMs, tz) {
  const p = partsIn(new Date(epochMs), tz);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

const RELATIVE = {
  'היום': 0, 'מחר': 1, 'מחרתיים': 2, 'אתמול': -1,
};

/**
 * מפרש קלט תאריך חופשי בעברית ומחזיר מפתח YYYY-MM-DD, או null.
 * תומך ב: היום / מחר / מחרתיים / יום ראשון / 25.12 / 25/12/2026 / 2026-12-25 / "בעוד 3 ימים"
 */
export function parseDate(input, tz) {
  if (!input) return null;
  const raw = String(input).trim();
  const s = raw.replace(/\s+/g, ' ');
  const today = todayKey(tz);

  if (Object.hasOwn(RELATIVE, s)) return addDays(today, RELATIVE[s]);

  const inDays = s.match(/^(?:בעוד|עוד)\s+(\d{1,3})\s*(?:ימים|יום)$/);
  if (inDays) return addDays(today, Number(inDays[1]));

  const dayName = s.match(/^(?:ביום|יום)\s+(\S+)$/);
  if (dayName) {
    const idx = DAY_NAMES.indexOf(dayName[1]);
    if (idx !== -1) {
      const cur = weekdayOf(today);
      let delta = (idx - cur + 7) % 7;
      if (delta === 0) delta = 7; // "יום שני" כשהיום שני = השבוע הבא
      return addDays(today, delta);
    }
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return validKey(+iso[1], +iso[2], +iso[3]);

  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (dmy) {
    const d = +dmy[1];
    const m = +dmy[2];
    let y;
    if (dmy[3] === undefined) {
      const t = now(tz);
      y = t.year;
      const candidate = validKey(y, m, d);
      // בלי שנה מפורשת: תאריך שעבר לפני יותר משבועיים מתפרש כשנה הבאה,
      // אבל "20.8" ביום 24.8 עדיין מתפרש כרישום בדיעבד על השנה הנוכחית.
      if (candidate && daysBetween(today, candidate) < -14) return validKey(y + 1, m, d);
      return candidate;
    }
    y = +dmy[3];
    if (y < 100) y += 2000;
    return validKey(y, m, d);
  }

  return null;
}

function validKey(y, m, d) {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return isoKey(y, m, d);
}

/** מפרש שעה בפורמט HH:MM או HH ומחזיר {hour, minute} או null. */
export function parseTime(input) {
  if (!input) return null;
  const m = String(input).trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hour = +m[1];
  const minute = m[2] === undefined ? 0 : +m[2];
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}
