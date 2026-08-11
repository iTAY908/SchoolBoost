/**
 * מחולל הפסקול ואפקטי הקול של סרטון ה"סטורי" (29.2 שניות, 876 פריימים @30fps).
 *
 * כל הצלילים מסונתזים כאן ונכתבים ל-public/audio בשם story-*.m4a,
 * כדי שהפרויקט לא יהיה תלוי בשום ספריית סאונד חיצונית או בגישה לרשת.
 *
 * מוזיקלית: סול מינור, 116.85 BPM, Gm · E♭maj7 · B♭ · F —
 * מכוון להיות שונה מפס המוזיקה הקיים (לה מינור, 120 BPM, Am-F-C-G).
 *
 * הרצה:  node scripts/make-story-audio.mjs
 *        node scripts/make-story-audio.mjs --music-only   (רק פס המוזיקה)
 *
 * --music-only מחדש רק את story-music.m4a ומשאיר את חמשת האפקטים
 * ללא שינוי (הם מכילים רעש אקראי — הרצה מחדש הייתה משנה אותם).
 * המדידה בסוף רצה תמיד על כל ששת הקבצים שעל הדיסק.
 *
 * חשוב: הרינדור של Remotion מנגן m4a אבל **לא** wav (wav יוצא דומם
 * לגמרי, בלי שום שגיאה). לכן כל נכס נכתב כ-wav ומיד מומר ל-m4a.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import { SR, toM4a, writeWav as writeWavFile } from "./lib/audio.mjs";

const OUT = path.join(process.cwd(), "public", "audio");

/* ── עזרי DSP ───────────────────────────────────────────── */

const buffer = (seconds) => new Float32Array(Math.round(seconds * SR));

/** דעיכה מעריכית */
const decay = (t, tau) => Math.exp(-t / tau);

/** מעטפת עם התקפה קצרה — מונעת נקישות בתחילת צליל */
const attack = (t, a) => (t < a ? t / a : 1);

/** מסנן מעביר־נמוך חד־קוטבי */
const lowpass = (data, cutoff) => {
  const a = Math.exp((-2 * Math.PI * cutoff) / SR);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (1 - a) * data[i] + a * last;
    data[i] = last;
  }
  return data;
};

/** מסנן מעביר־גבוה חד־קוטבי */
const highpass = (data, cutoff) => {
  const a = Math.exp((-2 * Math.PI * cutoff) / SR);
  let lastIn = 0;
  let lastOut = 0;
  for (let i = 0; i < data.length; i++) {
    const out = a * (lastOut + data[i] - lastIn);
    lastIn = data[i];
    lastOut = out;
    data[i] = out;
  }
  return data;
};

const mix = (dest, src, atSec, gain = 1) => {
  const off = Math.round(atSec * SR);
  for (let i = 0; i < src.length; i++) {
    const j = off + i;
    if (j >= 0 && j < dest.length) dest[j] += src[i] * gain;
  }
};

const peakOf = (data) => {
  let p = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]);
    if (v > p) p = v;
  }
  return p;
};

/** מכייל את הצליל לשיא מבוקש — שומר על היחסים הפנימיים */
const normalizeTo = (data, target) => {
  const p = peakOf(data);
  if (p > 0) {
    const g = target / p;
    for (let i = 0; i < data.length; i++) data[i] *= g;
  }
  return data;
};

/** דעיכה קצרה בסוף הקובץ — מונעת נקישה מקצה חתוך */
const fadeTail = (data, seconds) => {
  const n = Math.min(data.length, Math.round(seconds * SR));
  for (let i = 0; i < n; i++) {
    data[data.length - 1 - i] *= i / n;
  }
  return data;
};

/** הגבלה רכה — מונעת גזירה בלי לשטח את הטרנזיאנטים */
const softClip = (data, drive = 1.1) => {
  for (let i = 0; i < data.length; i++) data[i] = Math.tanh(data[i] * drive);
  return data;
};

/**
 * כותב את הצליל ומיד ממיר ל-m4a ומוחק את ה-wav.
 * Remotion מנגן m4a אבל לא wav — ראו ההערה ב-scripts/lib/audio.mjs.
 */
const writeSound = (name, samples) => {
  const wav = path.join(OUT, `${name}.wav`);
  writeWavFile(wav, samples);
  toM4a(wav, path.join(OUT, `${name}.m4a`));
  console.log(
    `  כתב ${name.padEnd(16)} ${(samples.length / SR).toFixed(3)}s  שיא ${peakOf(samples).toFixed(3)}`,
  );
};

/* ── אפקטי קול ──────────────────────────────────────────── */

/** וווש — סריקת רעש למעברים, עם זנב סטריאו־דמוי (עיכוב קצר) */
const whoosh = () => {
  const len = 0.72;
  const d = buffer(len);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const p = t / len;
    // מעטפת א־סימטרית: עלייה איטית, שיא ב-70%, נפילה חדה
    const env = Math.pow(Math.sin(Math.PI * Math.pow(p, 0.72)), 1.5);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  // סריקת מסנן מדומה: שכבה כהה + שכבה בהירה עם משקלים משתנים
  const dark = Float32Array.from(d);
  const bright = Float32Array.from(d);
  lowpass(dark, 900);
  highpass(bright, 2200);
  lowpass(bright, 9000);
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length;
    d[i] = dark[i] * (1 - p) * 1.6 + bright[i] * p * 1.1;
  }
  highpass(d, 220);
  // נגיעת דופלר — טון נמוך שמלווה את הסריקה
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const p = t / len;
    const f = 180 + 520 * p;
    d[i] += Math.sin(2 * Math.PI * f * t) * Math.sin(Math.PI * p) * 0.12;
  }
  softClip(d, 1.05);
  fadeTail(d, 0.02);
  return normalizeTo(d, 0.72);
};

/** אימפקט — בום נמוך עם טרנזיאנט, לכניסת קלפים */
const impact = () => {
  const d = buffer(1.15);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    // סינוס שצונח בגובה — הגוף של המכה
    const f = 148 * Math.exp(-t * 11) + 46;
    const body = Math.sin(2 * Math.PI * f * t) * decay(t, 0.3);
    // סאב מתחת, נשאר קצת יותר
    const sub = Math.sin(2 * Math.PI * 41 * t) * decay(t, 0.42) * 0.55;
    // טרנזיאנט רעש קצר בתחילת הצליל
    const click = (Math.random() * 2 - 1) * decay(t, 0.011) * 0.55;
    // זנב "חדר" — רעש מסונן שדועך לאט, נותן גודל בלי לקנטר
    const tail = (Math.random() * 2 - 1) * decay(t, 0.19) * 0.09;
    d[i] = (body * 0.8 + sub + click * 0.9 + tail) * attack(t, 0.0018);
  }
  lowpass(d, 2600);
  highpass(d, 28);
  softClip(d, 1.1);
  fadeTail(d, 0.06);
  return normalizeTo(d, 0.86);
};

/** רַייזר — מתח עולה לפני מעבר */
const riser = () => {
  const len = 1.25;
  const d = buffer(len);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const p = t / len;
    const env = Math.pow(p, 2.1);
    // רעש שמתבהר
    const noise = (Math.random() * 2 - 1) * 0.55;
    // שני טונים עולים במרווח חמישית — מוסיקלי, לא "טריילר"
    const f1 = 220 * Math.pow(2, 2.4 * p);
    const f2 = f1 * 1.4983; // חמישית
    const tone =
      Math.sin(2 * Math.PI * f1 * t) * 0.32 + Math.sin(2 * Math.PI * f2 * t) * 0.2;
    d[i] = (noise + tone) * env;
  }
  highpass(d, 600);
  // רעד עדין שמאיץ — תחושת האצה
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length;
    const rate = 5 + 22 * p;
    d[i] *= 0.78 + 0.22 * Math.sin(2 * Math.PI * rate * (i / SR));
  }
  softClip(d, 1.05);
  // הרייזר נחתך לתוך המעבר — דעיכה קצרה מאוד, רק כדי למנוע נקישה
  fadeTail(d, 0.008);
  return normalizeTo(d, 0.8);
};

/**
 * טיק — נקישה **שקטה** לכל החלפת כתובית.
 * נשמע פעמים רבות בסרטון, ולכן הוא מכוון נמוך ורך בכוונה.
 */
const tick = () => {
  const d = buffer(0.075);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    // גוף רך — שני הרמוניות קרובות, דעיכה מהירה מאוד
    const tone =
      Math.sin(2 * Math.PI * 1480 * t) * decay(t, 0.0095) +
      Math.sin(2 * Math.PI * 2210 * t) * decay(t, 0.006) * 0.4;
    // נשיפת אוויר זעירה במקום קליק חד
    const air = (Math.random() * 2 - 1) * decay(t, 0.0035) * 0.22;
    d[i] = (tone + air) * attack(t, 0.0012);
  }
  highpass(d, 800);
  lowpass(d, 6500);
  // מעטפת יציאה — מוודאת שאין קצה חתוך
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length;
    if (p > 0.75) d[i] *= (1 - p) / 0.25;
  }
  return normalizeTo(d, 0.22);
};

/**
 * קאונטר — מלווה גרפיקה שסופרת 0→15 בכ-1.3 שניות.
 * טיקים בגובה עולה בסולם סול מינור פנטטוני, בקצב שמאט לקראת הסוף
 * (מונה מכני שמתייצב), ומכה מספקת שנוחתת על "15".
 */
const counter = () => {
  const CLIMB = 1.3; // משך הספירה
  const d = buffer(1.85); // כולל זנב לצליל הסיום
  const STEPS = 15;

  // סולם סול מינור פנטטוני, שלוש אוקטבות — הטיקים מטפסים בו
  const scale = [
    392.0, 466.16, 523.25, 587.33, 698.46, // G4 Bb4 C5 D5 F5
    783.99, 932.33, 1046.5, 1174.66, 1396.91, // G5 Bb5 C6 D6 F6
    1567.98, 1864.66, 2093.0, 2349.32, 2793.83, // G6 Bb6 C7 D7 F7
  ];

  for (let n = 1; n <= STEPS; n++) {
    const p = n / STEPS;
    // עקומת זמן: חצי ליניארי, חצי האטה — מרגיש כמו מונה שנעצר
    const at = CLIMB * (0.45 * p + 0.55 * (1 - Math.sqrt(1 - p)));
    if (n === STEPS) break; // ה-15 מקבל מכה נפרדת

    const f = scale[n - 1];
    const blip = buffer(0.09);
    for (let i = 0; i < blip.length; i++) {
      const t = i / SR;
      const tone =
        Math.sin(2 * Math.PI * f * t) * decay(t, 0.016) +
        Math.sin(2 * Math.PI * f * 2 * t) * decay(t, 0.008) * 0.28;
      const clk = (Math.random() * 2 - 1) * decay(t, 0.0022) * 0.3;
      blip[i] = (tone + clk) * attack(t, 0.0009);
    }
    highpass(blip, 400);
    // מתחזק קלות ככל שהמספר עולה — תחושת התקדמות
    mix(d, blip, at, 0.3 + 0.28 * p);
  }

  // המכה הסופית על "15" — פעמון + גוף נמוך + נצנוץ
  const hit = buffer(0.55);
  for (let i = 0; i < hit.length; i++) {
    const t = i / SR;
    const bell =
      Math.sin(2 * Math.PI * 783.99 * t) * decay(t, 0.16) +
      Math.sin(2 * Math.PI * 1174.66 * t) * decay(t, 0.11) * 0.5 +
      Math.sin(2 * Math.PI * 1567.98 * t) * decay(t, 0.07) * 0.28;
    const bodyF = 160 * Math.exp(-t * 16) + 98;
    const body = Math.sin(2 * Math.PI * bodyF * t) * decay(t, 0.17) * 0.85;
    const shimmer = (Math.random() * 2 - 1) * decay(t, 0.055) * 0.14;
    hit[i] = (bell * 0.55 + body + shimmer) * attack(t, 0.0015);
  }
  lowpass(hit, 9000);
  mix(d, hit, CLIMB, 1.0);

  softClip(d, 1.05);
  fadeTail(d, 0.08);
  return normalizeTo(d, 0.82);
};

/**
 * מכות ההדגשה של קטע השואוקייס — קובץ אחד שמותקן פעם אחת ב-26.70s.
 * שלוש מכות, אחת לכל ביט של הקטע, על רשת התיבות:
 *   0.0000s (=26.700) כותרת קינטית — בהיר וחד
 *   2.0538s (=28.754) קיר הכרטיסים — רחב יותר, עם זנב סוחף
 *   4.1077s (=30.808) נחיתת המותג  — הגדולה מכולן, עם סאב ופעמון בסול
 * הצלילים מכוונים לסול מינור כדי שיישבו בתוך הפסקול ולא לידו.
 */
const showcaseHits = (bar) => {
  const d = buffer(6.5);

  // מכה 1 — כותרת קינטית: קצרה, בהירה, מתקדמת
  const h1 = buffer(0.9);
  for (let i = 0; i < h1.length; i++) {
    const t = i / SR;
    const f = 190 * Math.exp(-t * 14) + 98; // צונח אל סול
    const body = Math.sin(2 * Math.PI * f * t) * decay(t, 0.17);
    const snap = (Math.random() * 2 - 1) * decay(t, 0.014) * 0.5;
    const ring = Math.sin(2 * Math.PI * 587.33 * t) * decay(t, 0.09) * 0.22; // D5
    h1[i] = (body * 0.85 + snap + ring) * attack(t, 0.0015);
  }
  lowpass(h1, 6000);
  mix(d, h1, 0, 0.72);

  // מכה 2 — קיר הכרטיסים: רחבה יותר, עם זנב רעש שנסחף פנימה
  const h2 = buffer(1.2);
  for (let i = 0; i < h2.length; i++) {
    const t = i / SR;
    const f = 165 * Math.exp(-t * 10) + 87.31; // צונח אל פה
    const body = Math.sin(2 * Math.PI * f * t) * decay(t, 0.22);
    const snap = (Math.random() * 2 - 1) * decay(t, 0.02) * 0.4;
    // זנב מסונן — נותן רוחב בלי להוסיף עוצמה
    const sweep = (Math.random() * 2 - 1) * decay(t, 0.16) * 0.16;
    const ring = Math.sin(2 * Math.PI * 466.16 * t) * decay(t, 0.13) * 0.2; // Bb4
    h2[i] = (body * 0.85 + snap + sweep + ring) * attack(t, 0.002);
  }
  lowpass(h2, 5200);
  mix(d, h2, bar, 0.78);

  // מכה 3 — נחיתת המותג: סאב עמוק + פעמון בסול, הגדולה מכולן
  const h3 = buffer(2.0);
  for (let i = 0; i < h3.length; i++) {
    const t = i / SR;
    const f = 210 * Math.exp(-t * 9) + 49; // צניחה עמוקה אל סול נמוך
    const body = Math.sin(2 * Math.PI * f * t) * decay(t, 0.34);
    const sub = Math.sin(2 * Math.PI * 49 * t) * decay(t, 0.5) * 0.6;
    const snap = (Math.random() * 2 - 1) * decay(t, 0.016) * 0.45;
    // פעמון על הטוניקה — מה שהופך את הנחיתה ל"מותגית" ולא סתם בום
    const bell =
      Math.sin(2 * Math.PI * 783.99 * t) * decay(t, 0.3) + // G5
      Math.sin(2 * Math.PI * 1174.66 * t) * decay(t, 0.2) * 0.45 + // D6
      Math.sin(2 * Math.PI * 1567.98 * t) * decay(t, 0.13) * 0.22; // G6
    const shimmer = (Math.random() * 2 - 1) * decay(t, 0.1) * 0.1;
    h3[i] = (body * 0.8 + sub + snap + bell * 0.34 + shimmer) * attack(t, 0.0018);
  }
  lowpass(h3, 9000);
  highpass(h3, 28);
  mix(d, h3, bar * 2, 1.0);

  softClip(d, 1.05);
  fadeTail(d, 0.1);
  // 0.83 ולא יותר: קידוד AAC מגדיל את השיא בכ-5% על טרנזיאנטים חדים כאלה
  return normalizeTo(d, 0.83);
};

/* ── פס המוזיקה ─────────────────────────────────────────── */

/**
 * 116.85 BPM — נבחר כך ששתי נקודות החיתוך נופלות על דאונביט:
 *   13 תיבות = 26.700s — בדיוק כניסת קלף הסיום
 *    3 תיבות =  6.1615s — סטינגר המעבר (יעד 6.17, סטייה 8.5ms ≈ רבע פריים)
 * שונה מכוון מ-120 BPM של הפסקול הקיים.
 */
const BAR = 26.7 / 13; // 2.05385s
const BEAT = BAR / 4; // 0.51346s
const BPM = 60 / BEAT; // ≈116.85

const CH = {
  Gm: { root: 98.0, notes: [196.0, 233.08, 293.66] }, // i
  Eb: { root: 77.78, notes: [155.56, 196.0, 233.08, 293.66] }, // VImaj7
  Bb: { root: 116.54, notes: [233.08, 293.66, 349.23] }, // III
  F: { root: 87.31, notes: [174.61, 220.0, 261.63] }, // VII
};

/**
 * מפת המבנה על רשת התיבות.
 *   תיבה  3 = 6.1615s — סטינגר המעבר (יעד 6.17)
 *   תיבה 13 = 26.700s — פתיחת השואוקייס (מדויק)
 *   תיבה 16 = 32.8615s — הפתרון לטוניקה, סוף הפעימה
 *
 * 33.20 (קלף הסיום) אינו יכול להיות דאונביט יחד עם 26.70:
 * 26.70/6.50 = 267/65, כלומר יישור מדויק של שניהם דורש תיבה של 0.1s.
 * לכן הפתרון נוחת בתיבה 16 ו**נמשך** אל תוך הקלף, והתופים נעצרים שם —
 * כך שבקטע הסיום אין דאונביט שיכול "לפספס" את החיתוך.
 */
const BAR_STING = 3;
const BAR_SHOWCASE = 13;
const BAR_RESOLVE = 16;
const SHOWCASE_AT = BAR * BAR_SHOWCASE; // 26.700s

/** 18 תיבות מכסות 36.97s — נחתך ל-35.7s בדיוק */
const CHART = [
  "Gm", "Eb", "Bb", "F", // 0.00 – 8.22  (תיבה 3 = 6.1615, בר הסטינגר)
  "Gm", "Eb", "Bb", "F", // 8.22 – 16.43
  "Gm", "Eb", "Bb", "F", // 16.43 – 24.65
  "Eb", // 24.65 – 26.70 — מתיחה לקראת השיא
  "Gm", "Eb", "F", // 26.70 – 32.86 — השואוקייס: i · VI · VII
  "Gm", "Gm", // 32.86 – 36.97 — פתרון לטוניקה, מוחזק מתחת לקלף הסיום
];

/** התיבות שבהן הארנג'מנט נפתח לשיא (חלון השואוקייס) */
const isClimax = (bar) => bar >= BAR_SHOWCASE && bar < BAR_RESOLVE;

const kick = () => {
  const d = buffer(0.42);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const f = 118 * Math.exp(-t * 30) + 48;
    d[i] = Math.sin(2 * Math.PI * f * t) * decay(t, 0.1) * attack(t, 0.0014);
  }
  return d;
};

const hat = (open = false) => {
  const len = open ? 0.16 : 0.045;
  const d = buffer(len);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    d[i] = (Math.random() * 2 - 1) * decay(t, open ? 0.055 : 0.011);
  }
  highpass(d, 7600);
  return d;
};

/** מחיאה רכה על הפעימה השלישית — נותנת דחיפה בלי להישמע כמו סנייר */
const clap = () => {
  const d = buffer(0.3);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    // שלוש נגיעות צפופות ואז זנב
    let env = 0;
    for (const [off, g] of [[0, 1], [0.009, 0.8], [0.019, 0.6]]) {
      if (t >= off) env += decay(t - off, 0.012) * g;
    }
    env += decay(t, 0.085) * 0.28;
    d[i] = (Math.random() * 2 - 1) * env;
  }
  highpass(d, 1100);
  lowpass(d, 5200);
  return d;
};

/** קראש רך — מסמן את הפתיח, הסטינגר והסיום */
const crash = () => {
  const d = buffer(1.4);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    d[i] = (Math.random() * 2 - 1) * decay(t, 0.36) * attack(t, 0.003);
  }
  highpass(d, 3800);
  return d;
};

/**
 * בונה את פס המוזיקה באורך המבוקש, עם מעטפת עוצמה מוחלקת
 * שמורידה את המוזיקה עמוק מתחת לדיבור ומרימה אותה בקטעים המעוצבים.
 */
const buildMusic = (seconds, lifts) => {
  const out = buffer(seconds);

  const kickS = kick();
  const hatClosed = hat(false);
  const hatOpen = hat(true);
  const clapS = clap();
  const crashS = crash();

  for (let bar = 0; bar < CHART.length; bar++) {
    const at = bar * BAR;
    if (at >= seconds) break;
    const { root, notes } = CH[CHART[bar]];
    const climax = isClimax(bar);
    const tail = bar >= BAR_RESOLVE; // אחרי הפתרון — אקורד מוחזק בלי פעימה

    /* בס */
    if (tail) {
      // תו ארוך מאוד שמחזיק מתחת לקלף הסיום
      const bass = buffer(BAR * 1.8);
      for (let i = 0; i < bass.length; i++) {
        const t = i / SR;
        const env = attack(t, 0.02) * decay(t, 2.4);
        bass[i] =
          (Math.sin(2 * Math.PI * root * t) * 0.82 +
            Math.sin(2 * Math.PI * root * 2 * t) * 0.2) *
          env;
      }
      lowpass(bass, 460);
      mix(out, bass, at, 0.5);
    } else if (climax) {
      // בשיא — שמיניות מונעות, אוקטבה מתחלפת. זה מה שדוחף את הקטע קדימה.
      for (let e = 0; e < 8; e++) {
        const f = root * (e % 4 === 3 ? 2 : 1);
        const len = BEAT * 0.46;
        const bass = buffer(len);
        for (let i = 0; i < bass.length; i++) {
          const t = i / SR;
          const env = attack(t, 0.006) * decay(t, len * 0.5);
          bass[i] =
            (Math.sin(2 * Math.PI * f * t) * 0.82 +
              Math.sin(2 * Math.PI * f * 2 * t) * 0.24) *
            env;
        }
        lowpass(bass, 520);
        mix(out, bass, at + e * (BEAT / 2), 0.5);
      }
    } else {
      // בס — תו ארוך עם נגיעה מקדימה בפעימה 3.5
      for (const [off, len, g] of [
        [0, BAR * 0.72, 1.0],
        [BEAT * 3.5, BEAT * 0.5, 0.6],
      ]) {
        const bass = buffer(len);
        for (let i = 0; i < bass.length; i++) {
          const t = i / SR;
          const env = attack(t, 0.014) * decay(t, len * 0.6);
          bass[i] =
            (Math.sin(2 * Math.PI * root * t) * 0.82 +
              Math.sin(2 * Math.PI * root * 2 * t) * 0.2) *
            env;
        }
        lowpass(bass, 460);
        mix(out, bass, at + off, 0.52 * g);
      }
    }

    // פד — אקורד מוחזק עם התקפה איטית וריחוף קל.
    // בשיא נוספת אוקטבה עליונה שמרחיבה את האקורד.
    const padLen = tail ? BAR * 2.4 : BAR * 1.05;
    const pad = buffer(padLen);
    for (let i = 0; i < pad.length; i++) {
      const t = i / SR;
      const env = tail
        ? attack(t, 0.12) * decay(t, 3.4)
        : attack(t, 0.26) * (1 - 0.3 * (t / BAR)) * decay(t, 2.6);
      let s = 0;
      for (const f of notes) {
        s += Math.sin(2 * Math.PI * f * t);
        s += Math.sin(2 * Math.PI * f * 1.004 * t) * 0.55;
        s += Math.sin(2 * Math.PI * f * 0.5 * t) * 0.22;
        if (climax) s += Math.sin(2 * Math.PI * f * 2 * t) * 0.3;
      }
      pad[i] = (s / (notes.length * 1.8)) * env;
    }
    lowpass(pad, climax ? 2400 : 1700);
    highpass(pad, 150);
    mix(out, pad, at, climax ? 0.4 : tail ? 0.36 : 0.3);

    /* תופים */
    if (!tail) {
      if (climax) {
        // ארבע על הרצפה + מחיאות על 2 ו-4 — האנרגיה המלאה של השואוקייס
        for (let e = 0; e < 4; e++) {
          mix(out, kickS, at + e * BEAT, e === 0 ? 0.88 : 0.72);
        }
        mix(out, clapS, at + BEAT, 0.32);
        mix(out, clapS, at + BEAT * 3, 0.32);
      } else {
        // קיק על 1 ו-3.5, מחיאה על 3
        mix(out, kickS, at, 0.78);
        mix(out, kickS, at + BEAT * 2.5, 0.6);
        mix(out, clapS, at + BEAT * 2, 0.2);
      }

      // היי־האט בשש־עשרה עם הדגשות
      for (let e = 0; e < 16; e++) {
        const isOpen = climax ? e % 4 === 3 : e === 14;
        const accent = e % 4 === 2 ? 1.0 : e % 2 === 0 ? 0.72 : 0.42;
        mix(
          out,
          isOpen ? hatOpen : hatClosed,
          at + e * (BEAT / 4),
          (isOpen ? 0.16 : 0.1) * accent * (climax ? 1.45 : 1),
        );
      }

      // פלאק־ארפג'ו קליל מעל האקורד, בתבנית מנוקדת
      const pattern = [0, 2, 1, 3, 2, 0];
      for (let e = 0; e < pattern.length; e++) {
        const f = notes[pattern[e] % notes.length] * 2;
        const arp = buffer(BEAT * 0.8);
        for (let i = 0; i < arp.length; i++) {
          const t = i / SR;
          arp[i] =
            (Math.sin(2 * Math.PI * f * t) +
              Math.sin(2 * Math.PI * f * 2 * t) * 0.18) *
            decay(t, 0.075) *
            attack(t, 0.003);
        }
        mix(out, arp, at + BEAT * 0.5 + e * BEAT * 0.5, climax ? 0.13 : 0.085);
      }

      // ליד — רק בשיא. מוטיב קצר על תווי האקורד, אוקטבה מעל הארפג'ו.
      if (climax) {
        const motif = [0, 1, 2, 1];
        for (let e = 0; e < motif.length; e++) {
          const f = notes[motif[e] % notes.length] * 2;
          const lead = buffer(BEAT * 1.1);
          for (let i = 0; i < lead.length; i++) {
            const t = i / SR;
            // גל דמוי־מסור רך: כמה הרמוניות בדעיכה
            let s = 0;
            for (let h = 1; h <= 4; h++) {
              s += Math.sin(2 * Math.PI * f * h * t) / h;
            }
            lead[i] = s * 0.5 * decay(t, 0.2) * attack(t, 0.012);
          }
          lowpass(lead, 4200);
          mix(out, lead, at + e * BEAT, 0.1);
        }
      }
    } else if (bar === BAR_RESOLVE) {
      // מכת הפתרון — הפעימה האחרונה של הטראק
      mix(out, kickS, at, 0.9);
    }
  }

  // קראשים על הרגעים המעוצבים — כולם על דאונביט
  mix(out, crashS, 0.0, 0.3); // פתיח
  mix(out, crashS, BAR * BAR_STING, 0.34); // 6.1615 — סטינגר המעבר
  mix(out, crashS, BAR * 12, 0.22); // 24.646 — מתיחה לקראת השיא
  mix(out, crashS, SHOWCASE_AT, 0.42); // 26.700 — פתיחת השואוקייס
  mix(out, crashS, BAR * BAR_RESOLVE, 0.34); // 32.8615 — הפתרון

  /* מעטפת עוצמה — שומרת על הקול בחזית.
     הרמפות מוחלקות כדי שלא יישמעו קפיצות עוצמה. */
  const gain = new Float32Array(out.length);
  /* עומק הדאק מכויל כך שאחרי הנרמול הסופי ה-RMS מתחת לדיבור יוצא ~0.025 —
     אותה רמה כמו בגרסאות הקודמות ו-כמו music-bed.m4a הקיים, כדי
     ש-volume 0.7 ב-Remotion יישאר נכון גם אחרי שהשיא התחזק. */
  const DUCK = 0.232;
  for (let i = 0; i < gain.length; i++) {
    const t = i / SR;
    let g = DUCK;
    for (const lift of lifts) {
      if (t >= lift.from && t < lift.to) g = lift.gain;
    }
    gain[i] = g;
  }
  // החלקה דו־כיוונית (~0.18s) — מונעת מדרגות עוצמה
  const smooth = (arr, tau) => {
    const a = Math.exp(-1 / (tau * SR));
    let last = arr[0];
    for (let i = 0; i < arr.length; i++) {
      last = (1 - a) * arr[i] + a * last;
      arr[i] = last;
    }
    last = arr[arr.length - 1];
    for (let i = arr.length - 1; i >= 0; i--) {
      last = (1 - a) * arr[i] + a * last;
      arr[i] = last;
    }
    return arr;
  };
  smooth(gain, 0.09);

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const fadeIn = Math.min(1, t / 0.35);
    const fadeOut = Math.min(1, (seconds - t) / 1.1);
    out[i] *= gain[i] * fadeIn * fadeOut * 0.62;
  }

  softClip(out, 1.05);
  return normalizeTo(out, 0.82);
};

/* ── כתיבה ──────────────────────────────────────────────── */

const TOTAL = 35.7; // 1071 פריימים @30fps

const musicOnly = process.argv.includes("--music-only");

console.log(
  `סינתזה — סול מינור, ${BPM.toFixed(2)} BPM, Gm·E♭maj7·B♭·F` +
    (musicOnly ? "  (רק נכסי הפסקול)" : ""),
);

if (!musicOnly) {
  writeSound("story-whoosh", whoosh());
  writeSound("story-impact", impact());
  writeSound("story-riser", riser());
  writeSound("story-tick", tick());
  writeSound("story-counter", counter());
}

writeSound("story-showcase-hits", showcaseHits(BAR));

/**
 * הרמות העוצמה. ה"from" מוקדם ב-~0.1s מגבול הקטע כי מעטפת העוצמה
 * מוחלקת — כך ההרמה כבר בשיאה כשהקטע נכנס בפועל.
 *   0.00–1.50  קלף פתיחה   → הרמה
 *   1.50–6.17  קליפ A      → דאק
 *   6.17–6.90  סטינגר      → הרמה
 *   6.90–26.70 קליפ B      → דאק
 *  26.70–33.20 שואוקייס    → השיא — אין דיבור, המוזיקה נפתחת במלואה
 *  33.20–35.70 קלף סיום    → הרמה, אקורד מוחזק אחרי הפתרון
 */
writeSound(
  "story-music",
  buildMusic(TOTAL, [
    { from: 0.0, to: 1.55, gain: 1.15 }, // קלף הפתיחה המעוצב
    { from: 6.08, to: 6.95, gain: 1.3 }, // סטינגר המעבר
    { from: 26.6, to: 33.2, gain: 1.6 }, // השואוקייס — השיא של הטראק
    { from: 33.2, to: TOTAL, gain: 1.28 }, // קלף הסיום
  ]),
);

/* ── מדידה ──────────────────────────────────────────────── */

/** מפענח m4a חזרה ל-PCM ומודד — הבדיקה שהקובץ באמת מנגן משהו */
const decode = (file) => {
  const raw = execFileSync(
    ffmpeg,
    ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"],
    { maxBuffer: 1 << 28 },
  );
  const n = raw.length / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw.readInt16LE(i * 2) / 32768;
  return out;
};

const rmsOf = (data, from = 0, to = null) => {
  const a = Math.max(0, Math.round(from * SR));
  const b = Math.min(data.length, to === null ? data.length : Math.round(to * SR));
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += data[i] * data[i];
  return Math.sqrt(s / (b - a));
};

const NAMES = [
  "story-music",
  "story-showcase-hits",
  "story-whoosh",
  "story-impact",
  "story-riser",
  "story-tick",
  "story-counter",
];

console.log("\nמדידה (פענוח ה-m4a בחזרה ל-PCM):");
console.log("קובץ                  משך      שיא     RMS     תקין");

let ok = true;
let music = null;
for (const name of NAMES) {
  const file = path.join(OUT, `${name}.m4a`);
  const d = decode(file);
  const dur = d.length / SR;
  const pk = peakOf(d);
  const rms = rmsOf(d);
  const clip = pk >= 0.95;
  const silent = rms <= 0;
  if (clip || silent) ok = false;
  if (name === "story-music") music = d;
  console.log(
    `${(name + ".m4a").padEnd(22)}${dur.toFixed(3)}s  ${pk.toFixed(4)}  ${rms.toFixed(4)}  ` +
      `${clip ? "גזירה!" : silent ? "דומם!" : "כן"}`,
  );
}

// אורך פס המוזיקה
const musicDur = music.length / SR;
const durOk = Math.abs(musicDur - TOTAL) <= 0.05;
if (!durOk) ok = false;
console.log(
  `\nאורך פס המוזיקה: ${musicDur.toFixed(3)}s (יעד ${TOTAL}s, סטייה ${(musicDur - TOTAL).toFixed(4)}s) → ${durOk ? "תקין" : "שגוי"}`,
);

// השוואת חלונות מוחלשים מול חלונות מורמים
const windows = [
  ["הרמה — פתיח    0.30–1.40s", 0.3, 1.4],
  ["הרמה — סטינגר  6.25–6.88s", 6.25, 6.88],
  ["שיא  — שואוקייס 26.80–33.10s", 26.8, 33.1],
  ["הרמה — סיום   33.30–35.20s", 33.3, 35.2],
  ["דאק — קליפ A   2.50–6.00s", 2.5, 6.0],
  ["דאק — קליפ B   9.00–26.00s", 9.0, 26.0],
];
console.log("\nמעטפת העוצמה — RMS לפי חלון:");
const vals = {};
for (const [label, a, b] of windows) {
  const r = rmsOf(music, a, b);
  vals[label] = r;
  console.log(`  ${label}  RMS ${r.toFixed(4)}`);
}
const liftRms = Math.min(
  vals[windows[0][0]],
  vals[windows[1][0]],
  vals[windows[2][0]],
  vals[windows[3][0]],
);
const duckRms = Math.max(vals[windows[4][0]], vals[windows[5][0]]);
const ratioDb = 20 * Math.log10(liftRms / duckRms);
const duckOk = ratioDb >= 8;
if (!duckOk) ok = false;
console.log(
  `\n  הרמה החלשה ביותר / דאק החזק ביותר = ${(liftRms / duckRms).toFixed(2)}× (${ratioDb.toFixed(1)} dB) → ${duckOk ? "הפרש ברור" : "לא מספיק"}`,
);

// השואוקייס אמור להיות הקטע החזק בטראק — זה השיא, לא עוד הרמה
const showcaseRms = vals[windows[2][0]];
const otherLifts = [vals[windows[0][0]], vals[windows[1][0]], vals[windows[3][0]]];
const climaxOk = showcaseRms > Math.max(...otherLifts);
if (!climaxOk) ok = false;
console.log(
  `  השואוקייס מול ההרמות האחרות = ${(showcaseRms / Math.max(...otherLifts)).toFixed(2)}× → ${climaxOk ? "הוא אכן השיא" : "לא בולט מספיק"}`,
);

console.log(`\nסיכום: ${ok ? "כל הבדיקות עברו" : "נמצאו בעיות"}`);
if (!ok) process.exitCode = 1;
