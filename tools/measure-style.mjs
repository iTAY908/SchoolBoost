/**
 * מודד סגנון עריכה מקובץ וידאו ומייצר את ששת הפרקים של STYLE.md
 * במספרים. כל מה שנמדד מסומן MEASURED; כל מה שדורש עין אנושית
 * מסומן NEEDS-EYE ומקבל פריימים לבדיקה.
 *
 *   node measure-style.mjs <video.mp4> [outDir]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [, , VIDEO, OUT_DIR = "style-out"] = process.argv;
if (!VIDEO) {
  console.error("usage: node measure-style.mjs <video.mp4> [outDir]");
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const ff = (args, max = 1 << 28) =>
  execFileSync("ffmpeg", args, { maxBuffer: max, stdio: ["ignore", "pipe", "pipe"] });
const ffText = (args) => {
  try {
    return execFileSync("ffmpeg", args, {
      maxBuffer: 1 << 28,
      stdio: ["ignore", "pipe", "pipe"],
    }).toString() + execFileSync("true", []).toString();
  } catch (e) {
    return (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
  }
};
const probe = (args) =>
  execFileSync("ffprobe", args, { maxBuffer: 1 << 26 }).toString().trim();

/* ── 0 · בסיס ───────────────────────────────────────────── */

const meta = Object.fromEntries(
  probe([
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate,nb_frames",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1",
    VIDEO,
  ])
    .split("\n")
    .map((l) => l.split("=")),
);

const W = +meta.width;
const H = +meta.height;
const DUR = +meta.duration;
const [fn, fd] = String(meta.r_frame_rate).split("/").map(Number);
const FPS = fn / (fd || 1);

/* ── 1 · שוטים וחתכים ───────────────────────────────────── */

const sceneLog = ffText([
  "-v", "info", "-i", VIDEO,
  "-vf", "select='gt(scene,0.25)',metadata=print",
  "-f", "null", "-",
]);
const cutTimes = [...sceneLog.matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1]);

const bounds = [0, ...cutTimes, DUR];
const shots = [];
for (let i = 0; i < bounds.length - 1; i++) {
  const len = bounds[i + 1] - bounds[i];
  if (len > 0.04) shots.push({ start: bounds[i], end: bounds[i + 1], len });
}
const lens = shots.map((s) => s.len);
const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);

/* ── 2 · פרופיל תנועה בין פריימים ───────────────────────── */
/* משמש כדי להבחין בין חתך חד לבין מעבר רך (דיזולב/הבזק). */

const SW = 64;
const SH = Math.max(2, Math.round((H / W) * SW));
const raw = ff([
  "-v", "error", "-i", VIDEO,
  "-vf", `fps=${Math.min(FPS, 30)},scale=${SW}:${SH}`,
  "-f", "rawvideo", "-pix_fmt", "gray", "-",
]);
const fpsUsed = Math.min(FPS, 30);
const frameSize = SW * SH;
const nFrames = Math.floor(raw.length / frameSize);
const diffs = [];
const brightness = [];
for (let i = 0; i < nFrames; i++) {
  let sum = 0;
  for (let p = 0; p < frameSize; p++) sum += raw[i * frameSize + p];
  brightness.push(sum / frameSize);
  if (i === 0) continue;
  let d = 0;
  for (let p = 0; p < frameSize; p++) {
    d += Math.abs(raw[i * frameSize + p] - raw[(i - 1) * frameSize + p]);
  }
  diffs.push({ t: i / fpsUsed, d: d / frameSize });
}
const hardCuts = diffs.filter((x) => x.d > 28);
const softMoves = diffs.filter((x) => x.d > 10 && x.d <= 28);
const flashes = brightness
  .map((b, i) => ({ t: i / fpsUsed, b }))
  .filter((x, i, a) => i > 0 && x.b - a[i - 1].b > 38);

/* ── 3 · רצועת כתוביות ──────────────────────────────────── */
/* טקסט = שורות עם צפיפות מעברי־ניגודיות גבוהה. סורק את הגובה */
/* ומחזיר את הרצועה הדומיננטית באחוזים מהפריים.                */

const CW = 160;
const CH = Math.max(4, Math.round((H / W) * CW));
const rawC = ff([
  "-v", "error", "-i", VIDEO,
  "-vf", `fps=2,scale=${CW}:${CH}`,
  "-f", "rawvideo", "-pix_fmt", "gray", "-",
]);
const cFrame = CW * CH;
const cN = Math.floor(rawC.length / cFrame);
const rowScore = new Float64Array(CH);
for (let f = 0; f < cN; f++) {
  for (let y = 0; y < CH; y++) {
    let edges = 0;
    for (let x = 1; x < CW; x++) {
      const a = rawC[f * cFrame + y * CW + x];
      const b = rawC[f * cFrame + y * CW + x - 1];
      if (Math.abs(a - b) > 55) edges++;
    }
    rowScore[y] += edges;
  }
}
for (let y = 0; y < CH; y++) rowScore[y] /= cN || 1;
const maxRow = Math.max(...rowScore);
const textRows = [];
for (let y = 0; y < CH; y++) {
  if (maxRow > 4 && rowScore[y] > maxRow * 0.55) textRows.push(y);
}
const band =
  textRows.length > 0
    ? {
        topPct: ((Math.min(...textRows) / CH) * 100).toFixed(1),
        bottomPct: ((Math.max(...textRows) / CH) * 100).toFixed(1),
        heightPct: (((Math.max(...textRows) - Math.min(...textRows) + 1) / CH) * 100).toFixed(1),
      }
    : null;

/* ── 4 · אודיו ──────────────────────────────────────────── */

const pcm = ff([
  "-v", "error", "-i", VIDEO,
  "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-",
]);
const SR = 16000;
const nS = pcm.length / 2;
const win = Math.round(SR * 0.1);
const env = [];
for (let i = 0; i + win <= nS; i += win) {
  let s = 0;
  for (let j = 0; j < win; j++) {
    const v = pcm.readInt16LE((i + j) * 2) / 32768;
    s += v * v;
  }
  env.push(Math.sqrt(s / win));
}
const sorted = [...env].sort((a, b) => a - b);
const floorRms = sorted[Math.floor(sorted.length * 0.1)] || 0;
const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
const silentWindows = env
  .map((r, i) => ({ t: i * 0.1, r }))
  .filter((x) => x.r < Math.max(floorRms * 1.6, 0.004));
/* קיבוץ שקטים רצופים */
const silences = [];
for (const s of silentWindows) {
  const last = silences[silences.length - 1];
  if (last && Math.abs(s.t - (last.end + 0.1)) < 1e-6) last.end = s.t;
  else silences.push({ start: s.t, end: s.t });
}
const realSilences = silences.filter((s) => s.end - s.start >= 0.25);
/* תחילת הקול הראשון */
const firstVoice = env.findIndex((r) => r > Math.max(floorRms * 3, 0.01));

/* ── 5 · פריימים לבדיקה בעין ────────────────────────────── */

const sheet = path.join(OUT_DIR, "sheet.png");
ff([
  "-v", "error", "-i", VIDEO,
  "-vf", `fps=${(Math.min(30, nFrames) / DUR).toFixed(3)},scale=200:-1,tile=6x5`,
  "-frames:v", "1", "-y", sheet,
]);
const hook = path.join(OUT_DIR, "hook.png");
ff([
  "-v", "error", "-i", VIDEO, "-t", "3",
  "-vf", "fps=4,scale=200:-1,tile=6x2",
  "-frames:v", "1", "-y", hook,
]);

/* ── דוח ────────────────────────────────────────────────── */

const L = [];
const p = (s = "") => L.push(s);

p(`# STYLE.md — ${path.basename(VIDEO)}`);
p();
p(`\`${W}x${H}\` · ${FPS.toFixed(2)} fps · ${DUR.toFixed(2)}s · ${meta.nb_frames} frames`);
p();
p(`## 1 · שוטים וחתכים  [MEASURED]`);
p(`- חתכים שזוהו: **${cutTimes.length}**`);
p(`- שוטים: **${shots.length}**`);
if (lens.length) {
  p(`- אורך שוט ממוצע: **${mean.toFixed(2)}s**`);
  p(`- הקצר ביותר: **${Math.min(...lens).toFixed(2)}s**`);
  p(`- הארוך ביותר: **${Math.max(...lens).toFixed(2)}s**`);
  p(`- חתכים ל-30 שניות: **${((cutTimes.length / DUR) * 30).toFixed(1)}**${DUR < 30 ? "  ← מוחצן מקטע קצר מ-30s, לא מדידה ישירה" : ""}`);
}
p(`- נקודות חיתוך (שניות): ${cutTimes.length ? cutTimes.map((t) => t.toFixed(2)).join(", ") : "—"}`);
p();
p(`## 2 · הוק (3 שניות ראשונות)`);
p(`- הקול הראשון נשמע ב: **${firstVoice < 0 ? "לא זוהה" : (firstVoice * 0.1).toFixed(2) + "s"}**  [MEASURED]`);
p(`- חתכים בתוך 3 השניות הראשונות: **${cutTimes.filter((t) => t < 3).length}**  [MEASURED]`);
p(`- תנועה על המסך לפני המילה הראשונה: ` +
  (firstVoice > 0
    ? `שיא הפרש־פריימים = **${Math.max(...diffs.filter((d) => d.t < firstVoice * 0.1).map((d) => d.d), 0).toFixed(1)}** (0=סטילס)  [MEASURED]`
    : `—`));
p(`- מתי מופיעה הכתובית הראשונה: ראה פרק 3  [NEEDS-EYE: ${hook}]`);
p();
p(`## 3 · כתוביות`);
if (band) {
  p(`- רצועת טקסט דומיננטית: **${band.topPct}% – ${band.bottomPct}%** מגובה הפריים  [MEASURED]`);
  p(`- גובה הרצועה: **${band.heightPct}%** (~${Math.round((+band.heightPct / 100) * H)}px)  [MEASURED]`);
} else {
  p(`- **לא זוהתה רצועת כתוביות** — צפיפות הקצוות לא חרגה מהסף בשום גובה.  [MEASURED]`);
}
p(`- מילים בכרטיס / גודל גופן / צבע / רקע או מסגרת:  [NEEDS-EYE: ${sheet}]`);
p();
p(`## 4 · לייאאוט`);
p(`- סיווג פנים / בי-רול / מסך מפוצל דורש עין.  [NEEDS-EYE: ${sheet}]`);
p(`- אורכי השוטים בפרק 1 הם הבסיס לכמה זמן כל מצב מחזיק.  [MEASURED]`);
p();
p(`## 5 · מעברים ואפקטים  [MEASURED]`);
p(`- חתכים חדים (הפרש > 28): **${hardCuts.length}**`);
p(`- מעברים רכים / דיזולב (10–28): **${softMoves.length}**`);
p(`- הבזקי בהירות (קפיצה > 38): **${flashes.length}**${flashes.length ? " ב-" + flashes.map((f) => f.t.toFixed(2) + "s").join(", ") : ""}`);
p();
p(`## 6 · סאונד  [MEASURED]`);
p(`- RMS רצפה (אחוזון 10): **${floorRms.toFixed(4)}**`);
p(`- RMS אחוזון 95: **${p95.toFixed(4)}**`);
p(`- טווח דינמי: **${(20 * Math.log10((p95 || 1e-9) / (floorRms || 1e-9))).toFixed(1)} dB**`);
p(`- מקטעי שקט ≥ 0.25s: **${realSilences.length}**${realSilences.length ? " — " + realSilences.map((s) => `${s.start.toFixed(2)}–${(s.end + 0.1).toFixed(2)}`).join(", ") : ""}`);
p(`- רצפה גבוהה יחסית לשיא = יש מצע מוזיקה רציף; רצפה נמוכה מאוד = אין מצע.`);
p(`- **הערכה:** ${floorRms > p95 * 0.12 ? "כנראה **יש** מצע מוזיקה רציף" : "כנראה **אין** מצע מוזיקה — הרצפה שקטה מדי"}  [MEASURED-INFERENCE]`);
p();
p(`---`);
p(`גיליונות לבדיקה בעין: \`${sheet}\` · \`${hook}\``);

const md = L.join("\n");
fs.writeFileSync(path.join(OUT_DIR, "STYLE.md"), md);
console.log(md);
