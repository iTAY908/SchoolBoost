// Cinematic 5-second score for the logo intro, synthesized from scratch (no samples,
// no licensing questions). Hits line up with scene.html:
//   0.00-1.70  riser: low drone, swelling noise, quickening pulses
//   1.70       the hit: sub drop + impact + A-minor brass stab
//   2.15-2.75  five plucks, one per tagline word
//   3.25       second hit, chord moves to F major, sparkles (Google Play)
//   3.70-5.00  pad sustains and fades out
//   node music.js out.wav
const fs = require('fs');
const SR = 44100, DUR = 5.0, N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);       // midi -> Hz
const add = (i, v, pan = 0) => { if (i < 0 || i >= N) return; L[i] += v * (1 - pan) * .5 + v * .5; R[i] += v * (1 + pan) * .5 + v * .5; };

// one-pole low-pass helper
function lp(prev, x, cutoff) { const a = 1 - Math.exp(-2 * Math.PI * cutoff / SR); return prev + a * (x - prev); }

// ---- 1. low drone (A1) building up to the hit
{
  let y = 0;
  for (let i = 0; i < Math.round(SR * 1.72); i++) {
    const t = i / SR, env = Math.pow(t / 1.72, 1.6) * .35;
    let x = 0;
    for (let h = 1; h <= 8; h++) x += Math.sin(2 * Math.PI * hz(33) * h * t * (1 + .0015 * h)) / h;   // detuned saw-ish
    y = lp(y, x, 120 + 900 * Math.pow(t / 1.72, 2));
    add(i, y * env);
  }
}
// ---- 2. noise riser
{
  let y1 = 0, y2 = 0;
  for (let i = 0; i < Math.round(SR * 1.70); i++) {
    const t = i / SR, p = t / 1.70, env = Math.pow(p, 2.4) * .22;
    const n = rnd(); y1 = lp(y1, n, 300 + 9000 * p * p); y2 = lp(y2, y1, 300 + 9000 * p * p);
    const hp = n - y2;                                        // brighter as it rises
    add(i, (hp * .6 + y2 * .4) * env, Math.sin(t * 9) * .4);
  }
}
// ---- 3. quickening pulses (sub taps)
{
  const taps = [0.40, 0.75, 1.02, 1.24, 1.40, 1.52, 1.61];
  taps.forEach((t0, k) => {
    for (let i = 0; i < SR * .22; i++) {
      const t = i / SR, f = 70 - 30 * t / .22;
      add(Math.round((t0 + t) * SR), Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 22) * (.25 + k * .05));
    }
  });
}
// ---- 4. the hit at 1.70: sub drop + impact noise + cymbal
function impact(t0, gain) {
  for (let i = 0; i < SR * 2.2; i++) {                        // sub drop
    const t = i / SR, f = 62 * Math.exp(-t * 1.4) + 28;
    add(Math.round((t0 + t) * SR), Math.sin(2 * Math.PI * f * t + 2 * Math.sin(2 * Math.PI * 3 * t) * 0) * Math.exp(-t * 2.2) * .95 * gain);
  }
  let y = 0;
  for (let i = 0; i < SR * .7; i++) {                         // body thump (filtered noise)
    const t = i / SR; y = lp(y, rnd(), 900 - 700 * Math.min(1, t * 4));
    add(Math.round((t0 + t) * SR), y * Math.exp(-t * 9) * 1.4 * gain);
  }
  let z = 0;
  for (let i = 0; i < SR * 1.8; i++) {                        // cymbal wash
    const t = i / SR, n = rnd(); z = lp(z, n, 6000);
    add(Math.round((t0 + t) * SR), (n - z) * Math.exp(-t * 2.6) * .22 * gain, rnd() * .6);
  }
}
impact(1.70, 1.0);
impact(3.25, 0.45);

// ---- 5. chords: brass stab into a sustained pad
function chord(notes, t0, t1, gain, bright) {
  notes.forEach((m, k) => {
    let y = 0;
    const f = hz(m), pan = notes.length > 1 ? (k / (notes.length - 1) - .5) * .7 : 0;
    for (let i = Math.round(t0 * SR); i < Math.min(N, Math.round(t1 * SR)); i++) {
      const t = i / SR - t0;
      const att = Math.min(1, t / .02), rel = Math.min(1, (t1 - t0 - t) / .5);
      const env = att * rel * (.55 + .45 * Math.exp(-t * 3));
      let x = 0;
      for (let h = 1; h <= 10; h++) x += Math.sin(2 * Math.PI * f * h * t * (1 + (h % 2 ? .0008 : -.0008))) / h;
      x += .5 * Math.sin(2 * Math.PI * f * 1.003 * t);       // chorus
      y = lp(y, x, 400 + bright * Math.exp(-t * 2.5) + 500);  // brass "blat" that mellows
      add(i, y * env * gain, pan);
    }
  });
}
chord([45, 52, 57, 60, 64], 1.70, 3.40, .085, 5200);         // A minor
chord([41, 48, 53, 57, 60, 65], 3.25, 5.00, .075, 3500);     // F major (lift)
chord([33], 1.70, 3.30, .12, 300);                           // bass A
chord([29], 3.25, 5.00, .12, 300);                           // bass F

// ---- 6. plucks for the tagline words and sparkles for Google Play
function pluck(m, t0, gain, pan) {
  const f = hz(m);
  for (let i = 0; i < SR * 1.2; i++) {
    const t = i / SR;
    const x = Math.sin(2 * Math.PI * f * t) + .35 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 6) + .15 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t * 9);
    add(Math.round((t0 + t) * SR), x * Math.exp(-t * 4.2) * Math.min(1, t / .004) * gain, pan);
  }
}
[69, 72, 76, 79, 81].forEach((m, i) => pluck(m, 2.15 + i * .12, .11, (i - 2) * .25));
[84, 88, 91, 96].forEach((m, i) => pluck(m, 3.30 + i * .07, .06, (i % 2 ? .5 : -.5)));

// ---- 7. reverb (Schroeder: 4 combs + 2 all-passes per side)
function reverb(x, combs, aps, mix) {
  const out = new Float32Array(x.length);
  const cb = combs.map((d) => ({ d, buf: new Float32Array(d), i: 0, lp: 0 }));
  const ab = aps.map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  for (let n = 0; n < x.length; n++) {
    let s = 0;
    for (const c of cb) { const y = c.buf[c.i]; c.lp = c.lp + .3 * (y - c.lp); c.buf[c.i] = x[n] + c.lp * .84; c.i = (c.i + 1) % c.d; s += y; }
    s *= .25;
    for (const a of ab) { const y = a.buf[a.i]; const v = s + y * .5; a.buf[a.i] = v; a.i = (a.i + 1) % a.d; s = y - v * .5; }
    out[n] = x[n] * (1 - mix) + s * mix;
  }
  return out;
}
let outL = reverb(L, [1557, 1617, 1491, 1422], [225, 556], .32);
let outR = reverb(R, [1580, 1640, 1514, 1445], [248, 579], .32);

// ---- 8. master: fade in/out, normalize, soft clip, 16-bit WAV
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, g = Math.min(1, t / .05) * Math.min(1, (DUR - t) / .6);
  outL[i] *= g; outR[i] *= g; peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
}
const norm = .89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const sc = (v) => Math.tanh(v * 1.1) / Math.tanh(1.1);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(sc(outL[i] * norm) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(sc(outR[i] * norm) * 32767), 46 + i * 4);
}
fs.writeFileSync(process.argv[2] || 'music.wav', buf);
console.log('wrote', process.argv[2] || 'music.wav', (N / SR).toFixed(2) + 's');
