// Usage: node render.mjs [--frames 0,90,180] [--preview]   (requires ffmpeg + playwright)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const fi = args.indexOf('--frames');
const stills = fi >= 0 ? args[fi + 1].split(',').map(Number) : null;
const WORKERS = 4;

const browser = await chromium.launch();
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(pathToFileURL(path.join(here, 'src', 'index.html')).href + '?render=1');
  await page.evaluate(() => window.ready);
  return page;
}
const b64 = (u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');

if (stills) {
  const page = await newPage();
  for (const f of stills) {
    fs.writeFileSync(path.join(out, `still_${String(f).padStart(3, '0')}.png`), b64(await page.evaluate(f => window.renderFrameData(f), f)));
    console.log('still', f);
  }
  await browser.close();
  process.exit(0);
}

// 1) timing events for the soundtrack
{
  const page = await newPage();
  const ev = await page.evaluate(() => ({ events: window.RubberWall.EVENTS, burst: window.RubberWall.T_BURST, crack: window.RubberWall.T_CRACK }));
  fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(ev, null, 1));
  await page.close();
}
// 2) soundtrack
execFileSync('python3', [path.join(here, 'audio.py'), path.join(out, 'events.json'), path.join(here, 'src', 'soundtrack.wav')], { stdio: 'inherit' });

// 3) frames -> ffmpeg (video + audio muxed, exactly 15 s)
const NF = 450;
const mp4 = path.join(out, 'rubber_wall_15s.mp4');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
  '-i', path.join(here, 'src', 'soundtrack.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '15', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
const pages = await Promise.all(Array.from({ length: WORKERS }, newPage));
const buf = new Map();
let next = 0, written = 0;
const t0 = Date.now();
async function worker(page) {
  while (true) {
    const f = next++;
    if (f >= NF) return;
    buf.set(f, b64(await page.evaluate(f => window.renderFrameData(f), f)));
    while (buf.has(written)) {
      const data = buf.get(written); buf.delete(written);
      if (!ff.stdin.write(data)) await new Promise(r => ff.stdin.once('drain', r));
      written++;
      if (written % 30 === 0) console.log(`frame ${written}/${NF}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
}
await Promise.all(pages.map(worker));
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('wrote', mp4);
