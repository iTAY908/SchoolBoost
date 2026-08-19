/**
 * מכין את רצועות הדיבור של שני הצילומים.
 *
 * שני הקבצים הוקלטו בעוצמות שונות לחלוטין — part1 חזק עד כדי גזירה
 * ו-part2 שקט פי עשרים. הסקריפט מביא את שניהם לאותה עוצמת דיבור,
 * מגביל רכות את השיאים, וכותב m4a מוכן לשימוש.
 *
 *   node scripts/prepare-clips.mjs
 */
import path from "node:path";
import { normalizeVoice, readAudio, speechRms, toM4a, writeWav } from "./lib/audio.mjs";

const PUBLIC = path.join(process.cwd(), "public");
const SRC = path.join(PUBLIC, "source");
const OUT = path.join(PUBLIC, "audio");

/**
 * חייב להתאים ל-PART1 / PART2 ב-src/reel/timeline.ts
 * ול-CLIP_A / CLIP_B ב-src/story/timeline.ts
 */
const CLIPS = [
  { name: "part1-voice", file: "part1.mp4", from: 0.0, to: 6.3 },
  { name: "part2-voice", file: "part2.mp4", from: 1.0, to: 10.35 },
  { name: "story-a-voice", file: "story-a.mp4", from: 0.0, to: 4.67 },
  { name: "story-b-voice", file: "story-b.mp4", from: 0.0, to: 19.8 },
];

for (const clip of CLIPS) {
  const data = readAudio(path.join(SRC, clip.file), {
    from: clip.from,
    to: clip.to,
  });
  const before = speechRms(data);
  const { gain } = normalizeVoice(data);
  const after = speechRms(data);

  const wav = path.join(OUT, `${clip.name}.wav`);
  writeWav(wav, data);
  toM4a(wav, path.join(OUT, `${clip.name}.m4a`));

  console.log(
    `${clip.name.padEnd(12)} ${(data.length / 48000).toFixed(2)}s  ` +
      `speech rms ${before.rms.toFixed(4)} -> ${after.rms.toFixed(4)}  ` +
      `(gain ${gain.toFixed(2)}x)`,
  );
}
