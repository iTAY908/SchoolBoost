/**
 * מחולל פס המוזיקה ואפקטי הקול של הסרטון.
 *
 * כל הצלילים מסונתזים כאן ונכתבים ל-public/audio, כדי שהפרויקט
 * לא יהיה תלוי בשום ספריית סאונד חיצונית או בגישה לרשת.
 *
 *   node scripts/make-audio.mjs
 */
import path from "node:path";
import { SR, toM4a, writeWav as writeWavFile } from "./lib/audio.mjs";

const OUT = path.join(process.cwd(), "public", "audio");

/* ── עזרי כתיבה ─────────────────────────────────────────── */

/**
 * כותב את הצליל ומיד ממיר ל-m4a.
 * Remotion מנגן m4a אבל לא wav — ראו ההערה ב-scripts/lib/audio.mjs.
 */
const writeSound = (name, samples) => {
  const wav = path.join(OUT, `${name}.wav`);
  writeWavFile(wav, samples);
  toM4a(wav, path.join(OUT, `${name}.m4a`));
  console.log(`${name.padEnd(16)} ${(samples.length / SR).toFixed(2)}s`);
};

const buffer = (seconds) => new Float32Array(Math.round(seconds * SR));

/** דעיכה מעריכית */
const decay = (t, tau) => Math.exp(-t / tau);

/** מעטפת עם התקפה קצרה — מונעת נקישות בתחילת צליל */
const attack = (t, a) => (t < a ? t / a : 1);

/** מסנן חד־קוטבי פשוט */
const lowpass = (data, cutoff) => {
  const a = Math.exp((-2 * Math.PI * cutoff) / SR);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (1 - a) * data[i] + a * last;
    data[i] = last;
  }
  return data;
};

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

/* ── אפקטי קול ──────────────────────────────────────────── */

/** וווש — רעש לבן שעובר במסנן נע, לשימוש במעברים */
const whoosh = () => {
  const d = buffer(0.62);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const p = t / 0.62;
    // המעטפת עולה ויורדת
    const env = Math.sin(Math.PI * p) ** 1.6;
    d[i] = (Math.random() * 2 - 1) * env;
  }
  // סריקת תדר: נמוך -> גבוה -> נמוך, מדומה בשני מסננים
  lowpass(d, 2600);
  highpass(d, 420);
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length;
    d[i] *= 0.55 * (0.5 + 0.5 * Math.sin(Math.PI * p));
  }
  return d;
};

/** אימפקט — בום נמוך עם טרנזיאנט, לכניסת קלפים */
const impact = () => {
  const d = buffer(1.0);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    // סינוס שצונח בגובה
    const f = 120 * Math.exp(-t * 9) + 42;
    const body = Math.sin(2 * Math.PI * f * t) * decay(t, 0.26);
    // טרנזיאנט רעש קצר בתחילת הצליל
    const click = (Math.random() * 2 - 1) * decay(t, 0.012) * 0.5;
    d[i] = (body * 0.72 + click * 0.8) * attack(t, 0.002);
  }
  lowpass(d, 3200);
  return d;
};

/** צניחת סאב — לרגע הסיום */
const subDrop = () => {
  const d = buffer(1.3);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const f = 130 * Math.exp(-t * 2.2) + 36;
    d[i] = Math.sin(2 * Math.PI * f * t) * decay(t, 0.5) * 0.9 * attack(t, 0.004);
  }
  return d;
};

/** רַייזר — מתח עולה לפני מעבר */
const riser = () => {
  const d = buffer(0.85);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const p = t / 0.85;
    const noise = (Math.random() * 2 - 1) * 0.5;
    const tone = Math.sin(2 * Math.PI * (280 + 900 * p * p) * t) * 0.4;
    d[i] = (noise + tone) * p * p * 0.75;
  }
  highpass(d, 700);
  return d;
};

/** טיק — נקישה רכה לכל החלפת כתובית */
const tick = () => {
  const d = buffer(0.09);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const tone = Math.sin(2 * Math.PI * 1750 * t) * decay(t, 0.012);
    const air = (Math.random() * 2 - 1) * decay(t, 0.005) * 0.35;
    d[i] = (tone + air) * 0.34 * attack(t, 0.0008);
  }
  highpass(d, 900);
  return d;
};

/** פop — לכניסת אלמנט גרפי */
const pop = () => {
  const d = buffer(0.16);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const f = 900 * Math.exp(-t * 22) + 320;
    d[i] = Math.sin(2 * Math.PI * f * t) * decay(t, 0.035) * 0.42 * attack(t, 0.001);
  }
  return d;
};

/* ── פס המוזיקה ─────────────────────────────────────────── */

const BPM = 120;
const BEAT = 60 / BPM; // 0.5s
const BAR = BEAT * 4; // 2s

/** לה מינור — Am · F · C · G */
const PROGRESSION = [
  { root: 110.0, chord: [220.0, 261.63, 329.63] }, // Am
  { root: 87.31, chord: [174.61, 220.0, 261.63] }, // F
  { root: 130.81, chord: [261.63, 329.63, 392.0] }, // C
  { root: 98.0, chord: [196.0, 246.94, 293.66] }, // G
];

const kick = () => {
  const d = buffer(0.4);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    const f = 105 * Math.exp(-t * 26) + 45;
    d[i] = Math.sin(2 * Math.PI * f * t) * decay(t, 0.11) * attack(t, 0.0015);
  }
  return d;
};

const hat = (open = false) => {
  const len = open ? 0.14 : 0.05;
  const d = buffer(len);
  for (let i = 0; i < d.length; i++) {
    const t = i / SR;
    d[i] = (Math.random() * 2 - 1) * decay(t, open ? 0.05 : 0.014);
  }
  highpass(d, 7000);
  return d;
};

/**
 * בונה את פס המוזיקה באורך הנדרש, עם מעטפת עוצמה
 * שמורידה את המוזיקה מתחת לדיבור ומרימה אותה בקטעים המעוצבים.
 */
const buildMusic = (seconds, lifts) => {
  const out = buffer(seconds);
  const bars = Math.ceil(seconds / BAR);

  const kickS = kick();
  const hatClosed = hat(false);
  const hatOpen = hat(true);

  for (let bar = 0; bar < bars; bar++) {
    const at = bar * BAR;
    const { root, chord } = PROGRESSION[bar % PROGRESSION.length];

    // בס — תו ארוך לכל תיבה
    const bass = buffer(BAR);
    for (let i = 0; i < bass.length; i++) {
      const t = i / SR;
      const env = attack(t, 0.02) * decay(t, 1.1);
      bass[i] =
        (Math.sin(2 * Math.PI * root * t) * 0.8 +
          Math.sin(2 * Math.PI * root * 2 * t) * 0.18) *
        env;
    }
    lowpass(bass, 500);
    mix(out, bass, at, 0.5);

    // פד — אקורד מוחזק עם התקפה איטית
    const pad = buffer(BAR);
    for (let i = 0; i < pad.length; i++) {
      const t = i / SR;
      const env = attack(t, 0.22) * (1 - 0.25 * (t / BAR));
      let s = 0;
      for (const f of chord) {
        s += Math.sin(2 * Math.PI * f * t);
        s += Math.sin(2 * Math.PI * f * 1.005 * t) * 0.5; // ריחוף קל
      }
      pad[i] = (s / (chord.length * 1.5)) * env;
    }
    lowpass(pad, 1500);
    mix(out, pad, at, 0.3);

    // קיק בפעימות 1 ו-3
    mix(out, kickS, at + 0, 0.75);
    mix(out, kickS, at + 2 * BEAT, 0.62);

    // היי־האט בשמיניות
    for (let e = 0; e < 8; e++) {
      const isOpen = e === 7;
      mix(out, isOpen ? hatOpen : hatClosed, at + e * (BEAT / 2), isOpen ? 0.2 : 0.13);
    }

    // ארפג'ו עדין מעל האקורד
    for (let e = 0; e < 4; e++) {
      const f = chord[e % chord.length] * 2;
      const arp = buffer(BEAT);
      for (let i = 0; i < arp.length; i++) {
        const t = i / SR;
        arp[i] = Math.sin(2 * Math.PI * f * t) * decay(t, 0.10) * attack(t, 0.004);
      }
      mix(out, arp, at + e * BEAT + BEAT / 2, 0.1);
    }
  }

  // מעטפת עוצמה — שומרת על הקול בחזית
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let g = 0.26; // ברירת מחדל — עמוק מתחת לדיבור
    for (const lift of lifts) {
      if (t >= lift.from && t < lift.to) g = lift.gain;
    }
    // ריכוך קצוות
    const fadeIn = Math.min(1, t / 0.8);
    const fadeOut = Math.min(1, (seconds - t) / 1.0);
    out[i] *= g * fadeIn * fadeOut * 0.5;
  }

  // הגבלה רכה כדי למנוע גזירה
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.tanh(out[i] * 1.15) * 0.85;
  }

  return out;
};

/* ── כתיבה ──────────────────────────────────────────────── */

writeSound("whoosh", whoosh());
writeSound("impact", impact());
writeSound("sub-drop", subDrop());
writeSound("riser", riser());
writeSound("tick", tick());
writeSound("pop", pop());

/**
 * הרמות עוצמה: חזק בפתיח ובסיום, חלש מתחת לדיבור,
 * והרמה קצרה בסטינגר שבין שני הקטעים.
 * האורך תואם בדיוק לאורך ההרכב (ראו src/reel/theme.ts).
 */
writeSound(
  "music-bed",
  buildMusic(19.0, [
    { from: 0.0, to: 1.5, gain: 1.15 }, // פתיח מעוצב
    { from: 6.15, to: 7.0, gain: 1.25 }, // סטינגר
    { from: 16.35, to: 19.0, gain: 1.25 }, // סיום
  ]),
);
