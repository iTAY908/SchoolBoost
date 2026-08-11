/**
 * מחולל הפסקול ואפקטי הקול של סרטון ה"סטורי" (28.5 שניות, 855 פריימים @30fps).
 *
 * כל הצלילים מסונתזים כאן ונכתבים ל-public/audio בשם story-*.m4a,
 * כדי שהפרויקט לא יהיה תלוי בשום ספריית סאונד חיצונית או בגישה לרשת.
 *
 * מוזיקלית: סול מינור, 116.13 BPM, Gm · E♭maj7 · B♭ · F —
 * מכוון להיות שונה מפס המוזיקה הקיים (לה מינור, 120 BPM, Am-F-C-G).
 *
 * הרצה:  node scripts/make-story-audio.mjs
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

/* ── פס המוזיקה ─────────────────────────────────────────── */

/**
 * 116.13 BPM — נבחר כך ששלוש תיבות שלמות נופלות בדיוק על 6.2 שניות,
 * הרגע של סטינגר המעבר. שונה מכוון מ-120 BPM של הפסקול הקיים.
 */
const BAR = 6.2 / 3; // 2.0667s
const BEAT = BAR / 4; // 0.5167s
const BPM = 60 / BEAT; // ≈116.13

const CH = {
  Gm: { root: 98.0, notes: [196.0, 233.08, 293.66] }, // i
  Eb: { root: 77.78, notes: [155.56, 196.0, 233.08, 293.66] }, // VImaj7
  Bb: { root: 116.54, notes: [233.08, 293.66, 349.23] }, // III
  F: { root: 87.31, notes: [174.61, 220.0, 261.63] }, // VII
};

/** 14 תיבות מכסות 28.93s — נחתך ל-28.5s בדיוק */
const CHART = [
  "Gm", "Eb", "Bb", "F", // 0.00 – 8.27  (התיבה השלישית מתחילה ב-6.2)
  "Gm", "Eb", "Bb", "F", // 8.27 – 16.53
  "Gm", "Eb", "Bb", "F", // 16.53 – 24.80
  "Eb", "Gm", // 24.80 – 28.93 — פותר לטוניקה בסיום
];

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

    // פד — אקורד מוחזק עם התקפה איטית וריחוף קל
    const pad = buffer(BAR * 1.05);
    for (let i = 0; i < pad.length; i++) {
      const t = i / SR;
      const env = attack(t, 0.26) * (1 - 0.3 * (t / BAR)) * decay(t, 2.6);
      let s = 0;
      for (const f of notes) {
        s += Math.sin(2 * Math.PI * f * t);
        s += Math.sin(2 * Math.PI * f * 1.004 * t) * 0.55;
        s += Math.sin(2 * Math.PI * f * 0.5 * t) * 0.22;
      }
      pad[i] = (s / (notes.length * 1.8)) * env;
    }
    lowpass(pad, 1700);
    highpass(pad, 150);
    mix(out, pad, at, 0.3);

    // תופים — קיק על 1 ו-3.5, מחיאה על 3
    mix(out, kickS, at, 0.78);
    mix(out, kickS, at + BEAT * 2.5, 0.6);
    mix(out, clapS, at + BEAT * 2, 0.2);

    // היי־האט בשש־עשרה עם הדגשות
    for (let e = 0; e < 16; e++) {
      const isOpen = e === 14;
      const accent = e % 4 === 2 ? 1.0 : e % 2 === 0 ? 0.72 : 0.42;
      mix(
        out,
        isOpen ? hatOpen : hatClosed,
        at + e * (BEAT / 4),
        (isOpen ? 0.16 : 0.1) * accent,
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
      mix(out, arp, at + BEAT * 0.5 + e * BEAT * 0.5, 0.085);
    }
  }

  // קראשים על הרגעים המעוצבים
  mix(out, crashS, 0.0, 0.3);
  mix(out, crashS, 6.2, 0.34);
  mix(out, crashS, 24.8, 0.22);
  mix(out, crashS, 26.867, 0.3);

  /* מעטפת עוצמה — שומרת על הקול בחזית.
     הרמפות מוחלקות כדי שלא יישמעו קפיצות עוצמה. */
  const gain = new Float32Array(out.length);
  const DUCK = 0.2;
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

const TOTAL = 28.5; // 855 פריימים @30fps

console.log(`סינתזה — סול מינור, ${BPM.toFixed(2)} BPM, Gm·E♭maj7·B♭·F`);

writeSound("story-whoosh", whoosh());
writeSound("story-impact", impact());
writeSound("story-riser", riser());
writeSound("story-tick", tick());
writeSound("story-counter", counter());
writeSound(
  "story-music",
  buildMusic(TOTAL, [
    { from: 0.0, to: 1.55, gain: 1.15 }, // קלף הפתיחה המעוצב
    { from: 6.1, to: 6.95, gain: 1.3 }, // סטינגר המעבר
    { from: 25.85, to: TOTAL, gain: 1.25 }, // קלף הסיום
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
  ["הרמה — פתיח   0.30–1.40s", 0.3, 1.4],
  ["הרמה — סטינגר 6.25–6.90s", 6.25, 6.9],
  ["הרמה — סיום  26.20–28.00s", 26.2, 28.0],
  ["דאק — קליפ A  2.50–5.80s", 2.5, 5.8],
  ["דאק — קליפ B  9.00–24.00s", 9.0, 24.0],
];
console.log("\nמעטפת העוצמה — RMS לפי חלון:");
const vals = {};
for (const [label, a, b] of windows) {
  const r = rmsOf(music, a, b);
  vals[label] = r;
  console.log(`  ${label}  RMS ${r.toFixed(4)}`);
}
const liftRms = Math.min(vals[windows[0][0]], vals[windows[1][0]], vals[windows[2][0]]);
const duckRms = Math.max(vals[windows[3][0]], vals[windows[4][0]]);
const ratioDb = 20 * Math.log10(liftRms / duckRms);
const duckOk = ratioDb >= 8;
if (!duckOk) ok = false;
console.log(
  `\n  הרמה החלשה ביותר / דאק החזק ביותר = ${(liftRms / duckRms).toFixed(2)}× (${ratioDb.toFixed(1)} dB) → ${duckOk ? "הפרש ברור" : "לא מספיק"}`,
);

console.log(`\nסיכום: ${ok ? "כל הבדיקות עברו" : "נמצאו בעיות"}`);
if (!ok) process.exitCode = 1;
