// Sound for the first 5 seconds (ai-scene.html), synthesized like music.js:
// a quiet pulsing bed, a click per typed letter (type-times.json from render.js),
// a whoosh on "send", a shimmer while Cubey thinks, chimes as the answer lands,
// a falling counter while ₪1,150 becomes ₪350, and a riser into the logo.
//   node ai-music.js out.wav
const fs = require('fs'), path = require('path');
const SR = 44100, DUR = 5.0, N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 777;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const add = (i, v, pan = 0) => { if (i < 0 || i >= N) return; L[i] += v * (1 - pan * .8); R[i] += v * (1 + pan * .8); };
const lp = (prev, x, c) => prev + (1 - Math.exp(-2 * Math.PI * c / SR)) * (x - prev);
const at = (t) => Math.round(t * SR);

let typeTimes = [];
try { typeTimes = JSON.parse(fs.readFileSync(path.join(__dirname, 'type-times.json'), 'utf8')); } catch (e) {}

// bed: soft A-minor-9 pad with a gentle pulse on every beat (120 bpm)
[45, 52, 55, 59, 64].forEach((m, k) => {
  let y = 0;
  for (let i = at(.15); i < at(4.75); i++) {
    const t = i / SR, beat = (t - .6) * 2, ph = beat - Math.floor(beat);
    const duck = t > .6 ? .55 + .45 * Math.min(1, ph * 3) : 1;
    const env = Math.min(1, (t - .15) / .6) * Math.min(1, (4.75 - t) / .4) * duck;
    let x = 0; for (let h = 1; h <= 5; h++) x += Math.sin(2 * Math.PI * hz(m) * h * t * (1 + .0012 * k)) / (h * h);
    y = lp(y, x, 1400); add(i, y * env * .045, (k - 2) * .25);
  }
});
for (let b = 0; b < 8; b++) {                                   // soft kick on the beats
  const t0 = .6 + b * .5; if (t0 > 4.3) break;
  for (let i = 0; i < SR * .25; i++) { const t = i / SR; add(at(t0) + i, Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14) * .32); }
}
// typing: a short click per letter
typeTimes.forEach((t0, k) => {
  let y = 0; const c = 2500 + 1500 * Math.abs(rnd());
  for (let i = 0; i < SR * .035; i++) { const t = i / SR; y = lp(y, rnd(), c); add(at(t0) + i, (rnd() - y) * Math.exp(-t * 160) * .18, rnd() * .3); }
});
// send: whoosh up + blip
{ let y = 0; for (let i = 0; i < SR * .3; i++) { const t = i / SR, p = t / .3; y = lp(y, rnd(), 500 + 7000 * p); add(at(1.72) + i, y * Math.sin(Math.PI * p) * .35, -.4 + .8 * p); } }
function bell(m, t0, g, pan = 0, dec = 5) {
  for (let i = 0; i < SR * 1.0; i++) { const t = i / SR;
    const x = Math.sin(2 * Math.PI * hz(m) * t) + .4 * Math.sin(2 * Math.PI * hz(m) * 2.76 * t) * Math.exp(-t * 8) + .2 * Math.sin(2 * Math.PI * hz(m) * 5.4 * t) * Math.exp(-t * 14);
    add(at(t0) + i, x * Math.exp(-t * dec) * Math.min(1, t / .003) * g, pan); }
}
bell(88, 1.82, .05);
// thinking: a quiet sparkle arpeggio
[88, 91, 93, 96, 93, 91, 88, 91].forEach((m, k) => bell(m, 2.05 + k * .05, .025, k % 2 ? .5 : -.5, 9));
// the answer lands
bell(81, 2.45, .08, -.2); bell(88, 2.53, .07, .2);
// one tiny tick per word as it streams in
[0, 1, 2, 3].forEach((i) => bell(100, 2.50 + i * .08, .012, .3, 30));
for (let i = 0; i < 13; i++) bell(100, 3.70 + i * .045, .010, -.3, 30);
// the calculation: a counter ticking down in pitch
for (let k = 0; k < 18; k++) { const t0 = 3.05 + k * .6 / 18; bell(96 - k * .9, t0, .03, (k % 2 ? .3 : -.3), 40); }
// savings stay safe: a confirming major third
bell(84, 3.56, .06, -.15); bell(88, 3.62, .06, .15);
// riser into the logo (noise + rising tone), cut at 5.0 where the logo music starts
{ let y = 0; for (let i = at(4.25); i < N; i++) { const t = i / SR, p = (t - 4.25) / .75; y = lp(y, rnd(), 300 + 9000 * p * p);
    add(i, y * Math.pow(p, 2) * .4 + Math.sin(2 * Math.PI * (200 + 900 * p * p) * t) * Math.pow(p, 3) * .05, Math.sin(t * 20) * .3); } }

// light reverb, normalize to the same loudness as music.js (peak -1 dB), 16-bit WAV
function reverb(x, combs, aps, mix) {
  const out = new Float32Array(x.length);
  const cb = combs.map((d) => ({ d, buf: new Float32Array(d), i: 0, lp: 0 })), ab = aps.map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  for (let n = 0; n < x.length; n++) {
    let s = 0;
    for (const c of cb) { const y = c.buf[c.i]; c.lp += .3 * (y - c.lp); c.buf[c.i] = x[n] + c.lp * .8; c.i = (c.i + 1) % c.d; s += y; }
    s *= .25;
    for (const a of ab) { const y = a.buf[a.i], v = s + y * .5; a.buf[a.i] = v; a.i = (a.i + 1) % a.d; s = y - v * .5; }
    out[n] = x[n] * (1 - mix) + s * mix;
  }
  return out;
}
const oL = reverb(L, [1557, 1617, 1491, 1422], [225, 556], .25), oR = reverb(R, [1580, 1640, 1514, 1445], [248, 579], .25);
let peak = 0; for (let i = 0; i < N; i++) { const g = Math.min(1, i / SR / .05) * Math.min(1, (DUR - i / SR) / .08); oL[i] *= g; oR[i] *= g; peak = Math.max(peak, Math.abs(oL[i]), Math.abs(oR[i])); }
const norm = .80 / peak, sc = (v) => Math.tanh(v * 1.1) / Math.tanh(1.1);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(sc(oL[i] * norm) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(sc(oR[i] * norm) * 32767), 46 + i * 4); }
fs.writeFileSync(process.argv[2] || 'ai-music.wav', buf);
console.log('wrote', process.argv[2] || 'ai-music.wav', typeTimes.length + ' typing clicks');
