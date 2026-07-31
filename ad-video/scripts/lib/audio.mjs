import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";

export const SR = 48000;

/** כותב מערך float כ-WAV PCM 16 ביט מונו */
export const writeWav = (file, samples) => {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
};

/**
 * ממיר ל-AAC.
 *
 * חשוב: הרינדור של Remotion מנגן קובצי m4a אבל **לא** קובצי wav —
 * wav יוצא דומם לגמרי. לכן כל נכס אודיו חייב לעבור המרה כאן.
 */
export const toM4a = (wavFile, m4aFile, bitrate = "160k") => {
  execFileSync(ffmpeg, [
    "-v", "error",
    "-i", wavFile,
    "-c:a", "aac",
    "-b:a", bitrate,
    "-y", m4aFile,
  ]);
  fs.unlinkSync(wavFile);
};

/** מחלץ ערוץ אודיו מקובץ וידאו כמערך float מונו */
export const readAudio = (videoFile, { from = 0, to = null } = {}) => {
  const args = ["-v", "error"];
  if (from > 0) args.push("-ss", String(from));
  args.push("-i", videoFile);
  if (to !== null) args.push("-t", String(to - from));
  args.push("-vn", "-ac", "1", "-ar", String(SR), "-f", "s16le", "-");

  const raw = execFileSync(ffmpeg, args, { maxBuffer: 1 << 28 });
  const n = raw.length / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw.readInt16LE(i * 2) / 32768;
  return out;
};

/** מסנן מעביר־גבוה חד־קוטבי — מנקה רעש נמוך והמהום */
export const highpass = (data, cutoff) => {
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

/**
 * מודד את עוצמת הדיבור בלבד — ממוצע על החלונות החזקים,
 * כך שהשתיקות בין המשפטים לא מושכות את המדידה למטה.
 */
export const speechRms = (data) => {
  const win = Math.round(SR * 0.02);
  const frames = [];
  for (let i = 0; i + win <= data.length; i += win) {
    let s = 0;
    for (let j = 0; j < win; j++) s += data[i + j] * data[i + j];
    frames.push(Math.sqrt(s / win));
  }
  const sorted = [...frames].sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.15)];
  const peak = sorted[Math.floor(sorted.length * 0.97)];
  const thr = noise + (peak - noise) * 0.3;
  const voiced = frames.filter((f) => f > thr);
  if (!voiced.length) return { rms: 0, noise };
  const mean = Math.sqrt(
    voiced.reduce((a, f) => a + f * f, 0) / voiced.length,
  );
  return { rms: mean, noise };
};

/**
 * מביא את הדיבור לעוצמת יעד אחידה ומגביל רכות את השיאים,
 * כדי ששני הצילומים יישמעו באותה עוצמה בלי גזירה.
 */
export const normalizeVoice = (data, targetRms = 0.13, ceiling = 0.89) => {
  highpass(data, 85);
  const { rms } = speechRms(data);
  const gain = rms > 0 ? targetRms / rms : 1;
  for (let i = 0; i < data.length; i++) {
    const x = data[i] * gain;
    // הגבלה רכה: ליניארי מתחת לסף, tanh מעליו
    data[i] = Math.abs(x) < ceiling * 0.7 ? x : Math.sign(x) * (ceiling * 0.7 + (ceiling - ceiling * 0.7) * Math.tanh((Math.abs(x) - ceiling * 0.7) / (ceiling * 0.3)));
  }
  return { gain, sourceRms: rms };
};
