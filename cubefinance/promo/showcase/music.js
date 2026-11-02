// Original score for the 30-second showcase (synthesized; no samples, no licence needed).
// Calm, premium product-film bed: warm pad chords, a soft pluck pattern, a light
// pulse from the first phone shot, airy whooshes on every scene change, and a
// resolving chord + shimmer on the end card.
//   node music.js out.wav
const fs = require('fs');
const SR = 44100, DUR = 30.0, N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 4242;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const at = (t) => Math.round(t * SR);
const add = (i, v, pan = 0) => { if (i < 0 || i >= N) return; L[i] += v * (1 - pan * .7); R[i] += v * (1 + pan * .7); };
const lp = (y, x, c) => y + (1 - Math.exp(-2 * Math.PI * c / SR)) * (x - y);

// chord progression (one chord per scene): Dmaj9, Bm9, Gmaj9, Em9→A, Dmaj9, Dmaj9 (end)
const CH = [
  [0, [50, 57, 61, 64, 66]], [4, [47, 54, 57, 61, 62]], [9, [43, 50, 54, 57, 62]],
  [14, [40, 47, 50, 55, 59]], [18, [45, 52, 55, 59, 61]], [21, [50, 57, 61, 64, 66]], [26.6, [50, 57, 62, 66, 69]],
];
function pad(notes, t0, t1, g) {
  notes.forEach((m, k) => {
    let y = 0; const f = hz(m), pan = notes.length > 1 ? (k / (notes.length - 1) - .5) * .8 : 0;
    for (let i = at(t0); i < Math.min(N, at(t1 + .8)); i++) {
      const t = i / SR - t0, len = t1 - t0;
      const env = Math.min(1, t / .9) * Math.min(1, Math.max(0, (len + .8 - t) / 1.2));
      let x = 0; for (let h = 1; h <= 6; h++) x += Math.sin(2 * Math.PI * f * h * t * (1 + .0009 * h * (k % 2 ? 1 : -1))) / (h * h);
      x += .4 * Math.sin(2 * Math.PI * f * 1.004 * t);
      y = lp(y, x, 900 + 500 * Math.sin(t * .7) ** 2);
      add(i, y * env * g, pan);
    }
  });
}
CH.forEach(([t0, notes], i) => pad(notes, t0, i + 1 < CH.length ? CH[i + 1][0] : DUR, .035));
// bass
CH.forEach(([t0, notes], i) => pad([notes[0] - 12], t0, i + 1 < CH.length ? CH[i + 1][0] : DUR, .06));

// soft plucks on 8th notes from the first phone shot, following the chord tones
function pluck(m, t0, g, pan) {
  const f = hz(m);
  for (let i = 0; i < SR * .9; i++) { const t = i / SR;
    const x = Math.sin(2 * Math.PI * f * t) + .3 * Math.sin(2 * Math.PI * 2 * f * t) * Math.exp(-t * 8);
    add(at(t0) + i, x * Math.exp(-t * 5.5) * Math.min(1, t / .005) * g, pan); }
}
const BPM = 96, beat = 60 / BPM;
for (let t = 4.2; t < 26.4; t += beat / 2) {
  const ch = CH.filter(([t0]) => t0 <= t).pop()[1];
  const k = Math.round((t - 4.2) / (beat / 2));
  const tone = ch[[2, 3, 4, 3, 1, 3, 4, 2][k % 8]] + 12;
  pluck(tone, t, .028 * (k % 2 ? .7 : 1), (k % 2 ? .35 : -.35));
}
// gentle pulse (sub kick) on the beats, scenes 2-5
for (let t = 4.2; t < 26.2; t += beat) {
  for (let i = 0; i < SR * .3; i++) { const x = i / SR; add(at(t) + i, Math.sin(2 * Math.PI * (48 + 50 * Math.exp(-x * 26)) * x) * Math.exp(-x * 10) * .16); }
}
// airy whooshes into each scene change
[3.6, 8.6, 13.6, 20.6, 25.9].forEach((t0) => {
  let y = 0;
  for (let i = 0; i < SR * .9; i++) { const t = i / SR, p = t / .9; y = lp(y, rnd(), 400 + 6000 * Math.sin(Math.PI * p));
    add(at(t0) + i, y * Math.sin(Math.PI * p) ** 2 * .22, -.6 + 1.2 * p); }
});
// end card: a soft bell shimmer
function bell(m, t0, g, pan = 0) {
  for (let i = 0; i < SR * 2.5; i++) { const t = i / SR;
    const x = Math.sin(2 * Math.PI * hz(m) * t) + .35 * Math.sin(2 * Math.PI * hz(m) * 2.76 * t) * Math.exp(-t * 3);
    add(at(t0) + i, x * Math.exp(-t * 1.6) * Math.min(1, t / .004) * g, pan); }
}
[74, 78, 81, 86].forEach((m, k) => bell(m, 26.7 + k * .09, .05, (k - 1.5) * .3));
bell(62, 0.25, .05, 0); bell(69, 0.35, .035, .3);   // opening sparkle on the logo

// reverb + master: fade in/out, normalize to -1 dBFS
function reverb(x, combs, aps, mix) {
  const out = new Float32Array(x.length);
  const cb = combs.map((d) => ({ d, buf: new Float32Array(d), i: 0, lp: 0 })), ab = aps.map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  for (let n = 0; n < x.length; n++) {
    let s = 0;
    for (const c of cb) { const y = c.buf[c.i]; c.lp += .25 * (y - c.lp); c.buf[c.i] = x[n] + c.lp * .86; c.i = (c.i + 1) % c.d; s += y; }
    s *= .25;
    for (const a of ab) { const y = a.buf[a.i], v = s + y * .5; a.buf[a.i] = v; a.i = (a.i + 1) % a.d; s = y - v * .5; }
    out[n] = x[n] * (1 - mix) + s * mix;
  }
  return out;
}
const oL = reverb(L, [1557, 1617, 1491, 1422], [225, 556], .35), oR = reverb(R, [1580, 1640, 1514, 1445], [248, 579], .35);
let peak = 0;
for (let i = 0; i < N; i++) { const t = i / SR, g = Math.min(1, t / .3) * Math.min(1, (DUR - t) / 1.2); oL[i] *= g; oR[i] *= g; peak = Math.max(peak, Math.abs(oL[i]), Math.abs(oR[i])); }
const norm = .89 / peak, sc = (v) => Math.tanh(v * 1.05) / Math.tanh(1.05);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(sc(oL[i] * norm) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(sc(oR[i] * norm) * 32767), 46 + i * 4); }
fs.writeFileSync(process.argv[2] || 'music.wav', buf);
console.log('wrote', process.argv[2] || 'music.wav');
