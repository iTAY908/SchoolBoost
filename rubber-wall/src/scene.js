/*
 * "Rubber Wall" — 15s vertical (1080x1920 @30fps) ink & charcoal animation.
 * Pure Canvas2D, deterministic: renderFrame(ctx, frameIndex) draws any frame
 * independently, so the same file powers the live preview and the MP4 render.
 */
(function (global) {
  'use strict';
  const W_ = 1080, H_ = 1920, FPS = 30, DUR = 15, NF = DUR * FPS;
  const WALL = 9.0;            // world z of the rubber wall plane (metres)
  const FOC = 1340;            // focal length in px
  const HZ = 470;              // horizon line (elevated camera looking slightly down)
  const CXS = 540;
  const T_CRACK = 10.15, T_BURST = 10.5;
  const LT = 0.45, LS = 0.44;  // thigh, shin lengths
  const TEXT_LINES = ['גם כשמרגישים לכודים,', 'יש דרך החוצה.'];

  // ---------------------------------------------------------------- helpers
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = (t, c, w) => Math.exp(-((t - c) / w) * ((t - c) / w));
  function keyf(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
        const u = (t - t0) / (t1 - t0), s = u * u * (3 - 2 * u);
        return v0 + (v1 - v0) * s;
      }
    }
    return keys[keys.length - 1][1];
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const v3 = (x, y, z) => ({ x, y, z });
  const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
  const mul = (a, s) => v3(a.x * s, a.y * s, a.z * s);
  const mix3 = (a, b, t) => v3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));

  // ------------------------------------------------------------- timeline
  // speed of the boy (m/s) — run, impact, push (slowing as rubber resists), burst, slow down, stop
  const VK = [[0, 3.0], [2.9, 3.0], [3.05, 1.25], [3.35, 0.72], [4.5, 0.55], [6, 0.42], [8, 0.32],
    [10.0, 0.2], [10.5, 0.18], [10.75, 1.6], [11.1, 2.4], [11.9, 1.85], [12.7, 1.05], [13.5, 0.45], [14.2, 0.0], [15, 0]];
  // stride frequency (rad/s of the gait phase)
  const OK = [[0, 7.6], [2.85, 7.6], [3.25, 4.1], [4, 3.6], [10.3, 3.4], [10.6, 6.0], [11.1, 7.3],
    [12.0, 6.4], [12.8, 5.0], [13.6, 4.3], [14.3, 3.8], [15, 3.8]];
  const stall = (t) => gauss(t, 7.3, 0.32) + gauss(t, 8.9, 0.3);   // rubber pulls him back

  const DT = 1 / 1000, NS = Math.round(DUR / DT) + 2;
  const TL = { z: new Float64Array(NS), ph: new Float64Array(NS), v: new Float64Array(NS), A: new Float64Array(NS), K: new Float64Array(NS) };
  (function integrate() {
    let ph = 0.35, z = 0;
    for (let i = 0; i < NS; i++) {
      const t = i * DT;
      const vb = keyf(VK, t);
      let om = keyf(OK, t);
      let v = vb;
      if (t > 3.25 && t < 10.45) {
        const s = 0.5 + 0.5 * Math.cos(2 * ph);          // surge at each push-off
        const e = sstep(3.25, 3.7, t) * (1 - sstep(10.1, 10.45, t));
        v = vb * lerp(1, (0.3 + 1.4 * s) * (1 - 0.88 * stall(t)), e);
      }
      if (t > 13.0) om *= clamp(vb / 0.45, 0.0, 1);
      const P = sstep(2.7, 3.0, t) * (1 - sstep(10.5, 11.0, t));
      const A = om > 0.2 ? clamp(vb / (om * 0.85), 0, 0.5) : 0;
      TL.z[i] = z; TL.ph[i] = ph; TL.v[i] = v; TL.A[i] = A;
      TL.K[i] = Math.max(clamp(vb / 3, 0, 1), 0.55 * P);
      ph += om * DT; z += v * DT;
    }
  })();
  const idx = (t) => clamp(Math.round(t / DT), 0, NS - 1);

  // ------------------------------------------------------------- the boy
  function legAngles(ph, A, K) {
    const th = A * Math.sin(ph);
    const c = 0.5 + 0.5 * Math.cos(ph - (1.5 * Math.PI + 0.7));
    const kf = 0.12 + K * 1.85 * Math.pow(c, 2.0);
    return [th, kf];
  }
  let Z_OFFSET = 0;
  function pose(t) {
    const i = idx(t);
    const ph = TL.ph[i], A = TL.A[i], K = TL.K[i], vb = keyf(VK, t);
    const P = sstep(2.7, 3.0, t) * (1 - sstep(10.5, 11.0, t));
    const Rl = sstep(12.6, 13.8, t);
    const SB = sstep(13.9, 14.6, t);
    const st = stall(t) * (t < 10.4 ? 1 : 0);
    const runAmt = clamp(vb / 3, 0, 1);
    const crouch = 0.3 * P;
    // legs
    const legs = [];
    let lowest = 0;
    for (const s of [-1, 1]) {
      const phs = ph + (s > 0 ? Math.PI : 0);
      let [th, kf] = legAngles(phs, A, K);
      th += crouch * 0.35; kf += crouch * 0.6;
      th *= (1 - SB); kf = lerp(kf, 0.04, SB);
      const hip = v3(s * 0.1, 0, 0);
      const knee = add(hip, v3(s * 0.012, -LT * Math.cos(th), LT * Math.sin(th)));
      const a = th - kf;
      const ankle = add(knee, v3(-s * 0.01, -LS * Math.cos(a), LS * Math.sin(a)));
      const fa = a - 0.15;
      const toe = add(ankle, v3(0, 0.19 * Math.sin(fa) - 0.02, 0.19 * Math.cos(fa)));
      legs.push({ s, hip, knee, ankle, toe });
      lowest = Math.min(lowest, ankle.y);
    }
    const hipY = -lowest + 0.075;
    // torso
    let lean = keyf([[0, 0.2], [2.7, 0.22], [3.0, 0.42], [3.6, 0.62], [10.4, 0.66], [10.7, 0.5], [11.3, 0.3],
      [12.6, 0.15], [13.4, 0.03], [14.2, -0.05], [15, -0.03]], t);
    lean -= 0.22 * st;
    lean += 0.025 * Math.sin(t * 8.3) * P;
    const zb = TL.z[i] + Z_OFFSET;
    const sway = 0.022 * Math.sin(ph) * runAmt;
    const P0 = v3(sway, hipY, zb);
    const sd = v3(0, Math.cos(lean), Math.sin(lean));
    const breath = 0.04 * sstep(12.9, 13.6, t) - 0.068 * sstep(13.9, 14.7, t);
    const neck = add(P0, mul(sd, 0.5));
    neck.y += breath * 0.6;
    const SC = add(add(P0, mul(sd, 0.45)), v3(0, breath, 0));
    const twist = 0.05 * Math.sin(ph) * runAmt;
    const hl = 0.45 * lean;
    const hd = v3(0, Math.cos(hl), Math.sin(hl));
    const head = add(add(neck, mul(sd, 0.05)), mul(hd, 0.13));
    head.y += 0.006 * Math.sin(2 * ph) * runAmt;
    // arms
    const Aa = clamp(0.25 + 0.45 * vb / 3, 0, 0.8);
    const arms = [];
    for (const s of [-1, 1]) {
      const phs = ph + (s > 0 ? Math.PI : 0);
      const sh = add(SC, v3(s * 0.2 + sway * 0.5, 0, -s * twist));
      // run swing
      const al = -Aa * Math.sin(phs) + lean * 0.35;
      const elR = add(sh, v3(s * 0.035, -0.29 * Math.cos(al), 0.29 * Math.sin(al)));
      const be = al + 1.35 + 0.2 * Math.sin(phs);
      const haR = add(elR, v3(-s * 0.04, -0.27 * Math.cos(be), 0.27 * Math.sin(be)));
      // pushing the rubber
      const reach = 0.5 - 0.16 * st + 0.012 * Math.sin(t * 21 + s * 2) * P;
      const haP = add(sh, v3(s * 0.07, -0.17 + 0.01 * Math.sin(t * 17 + s), reach));
      const elP = add(mix3(sh, haP, 0.5), v3(s * 0.08, -0.12, -0.04 + 0.08 * st));
      // relaxed, hanging
      const elX = add(sh, v3(s * 0.045, -0.285, 0.015));
      const haX = add(elX, v3(s * 0.012, -0.255, 0.055));
      let el = mix3(elR, elP, P), ha = mix3(haR, haP, P);
      el = mix3(el, elX, Rl); ha = mix3(ha, haX, Rl);
      arms.push({ s, sh, el, ha });
    }
    // to world
    const W = (p) => v3(p.x + P0.x, p.y + P0.y, p.z + zb);
    const lw = legs.map(l => ({ s: l.s, hip: W(l.hip), knee: W(l.knee), ankle: W(l.ankle), toe: W(l.toe) }));
    return { t, P0, neck, head, SC, legs: lw, arms, lean, zb, ph, runAmt, P };
  }
  // align so the hands meet the wall exactly at t = 3.0 s
  (function align() {
    const p = pose(3.0);
    const hz = Math.max(p.arms[0].ha.z, p.arms[1].ha.z) + 0.05;
    Z_OFFSET = WALL - hz;
  })();

  // foot-contact & effort events (used for dust puffs and for the soundtrack)
  const EVENTS = (function () {
    const ev = [];
    let prev = -1;
    for (let t = 0; t <= DUR; t += 0.004) {
      const p = pose(t);
      const lo = p.legs[0].ankle.y < p.legs[1].ankle.y ? 0 : 1;
      const moving = TL.v[idx(t)] > 0.05 || t < 14;
      if (lo !== prev && prev !== -1 && moving && Math.abs(p.legs[0].ankle.y - p.legs[1].ankle.y) > 0.004) {
        ev.push({ type: 'step', t: +t.toFixed(3), leg: lo, x: p.legs[lo].ankle.x, z: p.legs[lo].ankle.z,
          phase: t < 3.0 ? 'run' : t < 10.5 ? 'push' : t < 11.0 ? 'burst' : 'out' });
      }
      prev = lo;
    }
    return ev.filter(e => e.t < 14.4);
  })();

  // --------------------------------------------------------------- camera
  function camera(t, p) {
    const dcam = keyf([[0, 4.0], [2.8, 4.0], [4, 4.2], [7, 4.55], [10.3, 4.85], [10.7, 4.8], [11.5, 4.25], [12.5, 3.85], [15, 3.55]], t);
    const camH = keyf([[0, 3.0], [3, 3.0], [7, 3.1], [10.5, 3.15], [12.5, 2.95], [15, 2.85]], t);
    const shake = 0.012 * Math.sin(2 * p.ph) * p.runAmt * (1 - sstep(12.5, 14, t));
    return { x: 0, y: camH + shake, z: p.zb - dcam };
  }
  function proj(cam, X, Y, Z) {
    const d = Z - cam.z;
    return [CXS + FOC * (X - cam.x) / d, HZ + FOC * (cam.y - Y) / d, d];
  }

  // ------------------------------------------------------ rubber wall mesh
  const NU = 121, NV = 72;
  const RX = new Float64Array(NU), RY = new Float64Array(NV);
  for (let i = 0; i < NU; i++) { const u = -1 + 2 * i / (NU - 1); RX[i] = Math.sign(u) * 14 * Math.pow(Math.abs(u), 1.8); }
  for (let j = 0; j < NV; j++) { const v = j / (NV - 1); RY[j] = 11 * Math.pow(v, 1.6); }

  function capsulesFromPose(p) {
    const caps = [];
    const c = (a, b, r) => caps.push({ a, b, r });
    c(p.head, p.head, 0.12);
    for (const a of p.arms) { c(a.sh, a.el, 0.06); c(a.el, a.ha, 0.05); c(a.ha, a.ha, 0.065); }
    c(p.P0, p.neck, 0.15);
    for (const l of p.legs) { c(l.hip, l.knee, 0.085); c(l.knee, l.ankle, 0.065); c(l.ankle, l.toe, 0.05); }
    return caps;
  }
  function sheetDepth(caps, X, Y) {
    let best = 0;
    for (let k = 0; k < caps.length; k++) {
      const C = caps[k];
      const ax = C.a.x, ay = C.a.y, bx = C.b.x, by = C.b.y;
      const dx = bx - ax, dy = by - ay;
      const L2 = dx * dx + dy * dy;
      let u = L2 > 1e-9 ? ((X - ax) * dx + (Y - ay) * dy) / L2 : 0;
      u = clamp(u, 0, 1);
      const px = ax + dx * u, py = ay + dy * u;
      const dist = Math.max(0, Math.hypot(X - px, Y - py) - C.r);
      const dk = lerp(C.a.z, C.b.z, u) + C.r - WALL;
      if (dk <= 0) continue;
      const sg = 0.12 + 0.32 * dk;
      const q = dist / sg;
      const val = dk / (1 + q * q);
      if (val > best) best = val;
    }
    if (best > 0) {   // radial folds
      const th = Math.atan2(Y - 1.3, X);
      best *= 1 + 0.035 * Math.sin(9 * th + 0.7) * clamp(best, 0, 1);
    }
    return best;
  }

  // tear geometry in rest (X,Y) space
  function holeShape(t, p) {
    if (t < T_CRACK) return null;
    const h = p.head;
    const cx0 = h.x, cy0 = h.y + 0.2;
    let cx, cy, rx, ry;
    if (t < T_BURST) {
      const u = sstep(T_CRACK, T_BURST, t);
      cx = cx0; cy = cy0; rx = lerp(0.04, 0.34, u); ry = lerp(0.008, 0.06, u);
    } else {
      const u = clamp((t - T_BURST) / 0.5, 0, 1);
      const el = 1 - Math.exp(-5.5 * u) * Math.cos(8.5 * u);
      const R1 = lerp(0.34, 1.6, el);
      const R2 = R1 + 2.6 * sstep(T_BURST + 0.25, T_BURST + 1.05, t);
      cx = lerp(cx0, 0, sstep(T_BURST, T_BURST + 0.6, t));
      cy = lerp(cy0, 1.65, sstep(T_BURST, T_BURST + 0.6, t));
      const sq = lerp(0.18, 1, sstep(T_BURST, T_BURST + 0.35, t));
      rx = R2; ry = R2 * sq * 1.3;
    }
    return { cx, cy, rx, ry };
  }
  const holeR = (th) => 1 + 0.12 * Math.sin(5 * th + 1.1) + 0.08 * Math.sin(9 * th + 2.3) + 0.05 * Math.sin(17 * th + 0.4) + 0.03 * Math.sin(31 * th);
  function inHole(hs, X, Y) {
    if (!hs) return false;
    const dx = (X - hs.cx) / hs.rx, dy = (Y - hs.cy) / hs.ry;
    const r = Math.hypot(dx, dy);
    return r < holeR(Math.atan2(dy, dx));
  }
  function relax(t) {
    if (t < T_BURST + 0.05) return 1;
    const tau = t - (T_BURST + 0.05);
    const s = Math.exp(-3.4 * tau) * Math.cos(7.2 * tau);
    return s < 0 ? s * 0.55 : s;
  }

  // ------------------------------------------------------------ textures
  let GRAIN = null, HATCH = null;
  function makeTextures() {
    if (GRAIN) return;
    GRAIN = [];
    for (let g = 0; g < 3; g++) {
      const c = document.createElement('canvas'); c.width = W_; c.height = H_;
      const x = c.getContext('2d');
      const img = x.createImageData(W_, H_);
      const r = rng(1234 + g * 77);
      for (let i = 0; i < W_ * H_; i++) {
        const n = 255 - Math.pow(r(), 6) * 140 - r() * 22;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = n; img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      // charcoal smudges & fibres
      for (let k = 0; k < 220; k++) {
        x.strokeStyle = `rgba(0,0,0,${0.02 + r() * 0.04})`;
        x.lineWidth = 0.6 + r() * 1.2;
        x.beginPath();
        const px = r() * W_, py = r() * H_, a = r() * Math.PI, L = 20 + r() * 90;
        x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * L * 0.5 + r() * 10, py + Math.sin(a) * L * 0.5, px + Math.cos(a) * L, py + Math.sin(a) * L);
        x.stroke();
      }
      GRAIN.push(c);
    }
    const hc = document.createElement('canvas'); hc.width = 256; hc.height = 256;
    const hx = hc.getContext('2d'); const r = rng(99);
    for (let k = 0; k < 140; k++) {
      hx.strokeStyle = `rgba(8,22,60,${0.08 + r() * 0.16})`;
      hx.lineWidth = 0.7 + r() * 1.6;
      const x0 = r() * 300 - 30, y0 = r() * 300 - 30, L = 30 + r() * 60;
      hx.beginPath(); hx.moveTo(x0, y0); hx.lineTo(x0 + L * 0.8, y0 - L * 0.55 + r() * 6); hx.stroke();
    }
    HATCH = hc;
  }

  // ------------------------------------------------------------ scribbles
  const SCRIB = (function () {
    const r = rng(4242), out = [];
    for (let i = 0; i < 18; i++) {
      const extra = i >= 10;
      let ox, oy, oz;
      if (i % 2 === 0) { ox = (r() * 2 - 1) * 0.95; oy = 1.95 + r() * 0.8; oz = -0.9 + r() * 1.2; if (Math.abs(ox) < 0.45) oy = Math.max(oy, 2.25); }
      else { ox = (r() < 0.5 ? -1 : 1) * (0.62 + r() * 0.7); oy = 0.9 + r() * 1.4; oz = -1.6 + r() * 1.0; }
      const loops = 3 + Math.floor(r() * 3), N = loops * 26;
      const pts = [];
      let cx = 0, cy = 0;
      const a1 = 2 + r() * 3, a2 = 5 + r() * 4, p1 = r() * 6, p2 = r() * 6;
      for (let j = 0; j < N; j++) {
        const th = 2 * Math.PI * j / 26 * (1 + 0.08 * r());
        cx += (r() - 0.5) * 0.06; cy += (r() - 0.5) * 0.06;
        cx *= 0.97; cy *= 0.97;
        const rad = 0.55 + 0.3 * Math.sin(th * a1 / 3 + p1) + 0.18 * Math.sin(th * a2 / 5 + p2);
        pts.push([cx + Math.cos(th) * rad, cy + Math.sin(th) * rad * (0.7 + 0.3 * r())]);
      }
      out.push({ i, extra, ox, oy, oz, size: 0.12 + r() * 0.12, rot: r() * 6, spin: (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.8), ph: r() * 6, pts, rr: r() });
    }
    return out;
  })();
  function scribWorld(s, t, p) {
    const C = sstep(5.5, 9.6, t);
    const drift = (tt) => [0.16 * Math.sin(tt * 0.7 + s.ph), 0.11 * Math.sin(tt * 0.9 + s.ph * 1.3), 0.12 * Math.sin(tt * 0.5 + s.ph * 0.7)];
    const rel = (tt, CC, pp) => {
      const [dx, dy, dz] = drift(tt);
      let ox = (s.ox + dx) * (1 - 0.18 * CC);
      if (Math.abs(ox) < 0.5 && s.oy < 2.2) ox = Math.sign(ox || 1) * 0.5;
      let oy = lerp(s.oy + dy, (Math.abs(ox) < 0.5 ? 2.05 : 1.2) + s.rr * 1.0, 0.5 * CC);
      let oz = lerp(s.oz + dz, -0.6 - 0.6 * s.rr, CC);
      return v3(pp.P0.x + ox, oy, pp.zb + oz);
    };
    if (t <= T_BURST) return rel(t, C, p);
    const pb = pose(T_BURST);
    const w0 = rel(T_BURST, sstep(5.5, 9.6, T_BURST), pb);
    const u = sstep(T_BURST, T_BURST + 0.6, t);
    const side = w0.x >= 0 ? 1 : -1;
    return v3(w0.x * (1 + 3.5 * u) + side * 2.0 * u, w0.y + (w0.y - 1.3) * 0.9 * u, lerp(w0.z, WALL + 0.2, u));
  }
  function drawScribble(ctx, cam, s, t, p, boil, wantNear) {
    const C = sstep(5.5, 9.6, t);
    let alpha = s.extra ? sstep(5.2 + s.rr * 3, 6.4 + s.rr * 3, t) : 1;
    if (alpha <= 0.01) return;
    const w = scribWorld(s, t, p);
    const [sx, sy, d] = proj(cam, w.x, w.y, w.z);
    if (d < 0.35) return;
    const near = w.z < p.zb - 0.05;
    if (near !== wantNear) return;
    alpha *= clamp((d - 0.8) / 1.2, 0, 1);
    if (t > T_BURST) alpha *= 1 - sstep(T_BURST + 0.05, T_BURST + 0.55, t);
    if (alpha <= 0.01) return;
    const size = s.size * (1 + 0.3 * C) * FOC / d;
    const rot = s.rot + s.spin * t * (1 + 1.6 * C);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const jr = rng(s.i * 1000 + boil);
    const wob = 0.05 + 0.07 * C;
    const P = s.pts.map(([x, y], j) => {
      const xx = x + wob * Math.sin(t * 3.1 + j * 0.37 + s.ph) + (jr() - 0.5) * 0.03;
      const yy = y + wob * Math.cos(t * 2.7 + j * 0.41 + s.ph) + (jr() - 0.5) * 0.03;
      return [sx + (xx * cr - yy * sr) * size, sy + (xx * sr + yy * cr) * size];
    });
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? `rgba(8,8,8,${0.88 * alpha})` : `rgba(30,30,30,${0.45 * alpha})`;
      ctx.lineWidth = Math.max(1.1, size * (pass === 0 ? 0.045 : 0.02));
      ctx.beginPath();
      const off = pass * size * 0.02;
      ctx.moveTo(P[0][0] + off, P[0][1] - off);
      for (let j = 1; j < P.length - 1; j++) {
        const mx = (P[j][0] + P[j + 1][0]) / 2, my = (P[j][1] + P[j + 1][1]) / 2;
        ctx.quadraticCurveTo(P[j][0] + off, P[j][1] - off, mx + off, my - off);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // --------------------------------------------------------- outside world
  const TREES = (function () {
    const r = rng(777);
    // [x, distance beyond wall, height]
    const spec = [[-4.5, 9, 7.6], [6.0, 13, 8.2], [-6.2, 21, 7.2], [8.6, 27, 7.6], [-3.4, 44, 5.2], [4.0, 52, 5.0], [-9.5, 36, 7.0], [-1.6, 70, 3.6], [2.0, 78, 3.4]];
    return spec.map(([x, dz, h], k) => {
      const blobs = [];
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, rr = Math.pow(r(), 0.7);
        blobs.push({ ox: Math.cos(a) * rr * 1.35, oy: Math.sin(a) * rr * 1.0, r: 0.22 + r() * 0.3, g: 150 + Math.floor(r() * 55), ph: r() * 6 });
      }
      blobs.sort((a, b) => a.oy - b.oy);
      return { x, z: WALL + dz, h, trunkH: h * 0.48, blobs, ph: r() * 6, lean: (r() - 0.5) * 0.08, k };
    }).sort((a, b) => b.z - a.z);
  })();
  const TUFTS = (function () {
    const r = rng(31337), out = [];
    for (let i = 0; i < 150; i++) {
      let x = (r() * 2 - 1) * 9; if (Math.abs(x) < 0.7) x += Math.sign(x || 1) * 0.8;
      out.push({ x, z: WALL + 0.6 + Math.pow(r(), 1.3) * 45, h: 0.1 + r() * 0.2, n: 3 + Math.floor(r() * 4), ph: r() * 6, g: 135 + Math.floor(r() * 50) });
    }
    return out.sort((a, b) => b.z - a.z);
  })();
  const BUSHES = [[-3.6, 15], [4.4, 18], [-1.8, 26], [2.2, 31]].map(([x, dz], k) => ({ x, z: WALL + dz, k }));

  function drawOutside(ctx0, cam, t) {
    const OL = layer('o'), ctx = OL.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W_, H_);
    // sky & light
    const g = ctx.createLinearGradient(0, 0, 0, HZ + 40);
    g.addColorStop(0, '#fbfbf9'); g.addColorStop(0.7, '#f3f3f0'); g.addColorStop(1, '#e6e6e2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W_, HZ + 2);
    const sun = ctx.createRadialGradient(560, 260, 10, 560, 260, 700);
    sun.addColorStop(0, 'rgba(255,255,255,0.95)'); sun.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W_, HZ);
    // ground
    const gg = ctx.createLinearGradient(0, HZ, 0, H_);
    gg.addColorStop(0, '#d9d9d4'); gg.addColorStop(0.25, '#e3e3df'); gg.addColorStop(1, '#efefec');
    ctx.fillStyle = gg; ctx.fillRect(0, HZ, W_, H_ - HZ);
    // distant soft tree-line haze
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const X = (i / 25 * 2 - 1) * 60, Z = WALL + 85 + r() * 20;
      const [sx, sy, d] = proj(cam, X, 0, Z);
      if (d <= 1) continue;
      const rad = FOC * (2.5 + r() * 2) / d;
      ctx.fillStyle = `rgba(150,150,148,${0.12 + r() * 0.08})`;
      ctx.beginPath(); ctx.ellipse(sx, sy - rad * 0.5, rad * 1.3, rad * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // tree shadows
    for (const tr of TREES) {
      const [sx, sy, d] = proj(cam, tr.x + 0.6, 0, tr.z + 0.4);
      if (d <= 0.5) continue;
      const s = FOC / d;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.18);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.7 * s); sg.addColorStop(0, 'rgba(110,110,110,0.16)'); sg.addColorStop(1, 'rgba(110,110,110,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 1.7 * s, 0, 7); ctx.fill(); ctx.restore();
    }
    // grass tufts
    ctx.lineCap = 'round';
    for (const tf of TUFTS) {
      const [sx, sy, d] = proj(cam, tf.x, 0, tf.z);
      if (d <= 0.6 || sx < -50 || sx > W_ + 50 || sy > H_ + 20) continue;
      const s = FOC / d;
      ctx.strokeStyle = `rgba(${tf.g},${tf.g},${tf.g - 4},0.85)`;
      ctx.lineWidth = Math.max(0.8, 0.012 * s);
      ctx.beginPath();
      for (let k = 0; k < tf.n; k++) {
        const a = (k / (tf.n - 1 || 1) - 0.5) * 1.0 + 0.12 * Math.sin(t * 2.1 + tf.ph + k);
        const bx = sx + (k - tf.n / 2) * 0.012 * s;
        ctx.moveTo(bx, sy);
        ctx.quadraticCurveTo(bx + Math.sin(a) * tf.h * 0.4 * s, sy - tf.h * 0.6 * s, bx + Math.sin(a) * tf.h * s, sy - tf.h * Math.cos(a) * s);
      }
      ctx.stroke();
    }
    // bushes
    for (const b of BUSHES) {
      const [sx, sy, d] = proj(cam, b.x, 0, b.z);
      if (d <= 0.6) continue;
      const s = FOC / d, rr = rng(900 + b.k);
      for (let i = 0; i < 9; i++) {
        const ox = (rr() - 0.5) * 0.9, oy = rr() * 0.25, rad = 0.16 + rr() * 0.14;
        const gv = 135 + Math.floor(rr() * 50);
        const sw = 0.02 * Math.sin(t * 1.9 + i + b.k) * s;
        ctx.fillStyle = `rgba(${gv},${gv},${gv},0.9)`;
        ctx.beginPath(); ctx.arc(sx + ox * s + sw, sy - (oy + rad * 0.7) * s, rad * s, 0, Math.PI * 2); ctx.fill();
      }
    }
    // trees
    for (const tr of TREES) {
      const [bx, by, d] = proj(cam, tr.x, 0, tr.z);
      if (d <= 0.6) continue;
      const s = FOC / d;
      if (bx < -4 * s || bx > W_ + 4 * s) continue;
      const topX = bx + tr.lean * tr.trunkH * s, topY = by - tr.trunkH * s;
      // trunk
      ctx.fillStyle = '#4b4b4b';
      ctx.beginPath();
      ctx.moveTo(bx - 0.16 * s, by); ctx.quadraticCurveTo(bx - 0.1 * s, by - tr.trunkH * 0.5 * s, topX - 0.07 * s, topY);
      ctx.lineTo(topX + 0.07 * s, topY); ctx.quadraticCurveTo(bx + 0.1 * s, by - tr.trunkH * 0.5 * s, bx + 0.16 * s, by);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4b4b4b'; ctx.lineCap = 'round';
      for (const sgn of [-1, 1]) {
        ctx.lineWidth = 0.05 * s;
        ctx.beginPath(); ctx.moveTo(topX, topY + 0.3 * s);
        ctx.quadraticCurveTo(topX + sgn * 0.4 * s, topY - 0.1 * s, topX + sgn * 0.8 * s, topY - 0.7 * s); ctx.stroke();
      }
      // canopy: many soft charcoal dabs, inked lightly, swaying
      const ccx = topX, ccy = topY - (tr.h - tr.trunkH) * 0.42 * s;
      const sway = Math.sin(t * 1.3 + tr.ph);
      const sc = (tr.h / 7) * 1.3 * s;
      ctx.save();
      for (const bl of tr.blobs) {
        const hgt = (bl.oy + 1) * 0.5;
        const ox = bl.ox + 0.06 * sway * (0.6 + hgt) + 0.02 * Math.sin(t * 4.2 + bl.ph);
        const oy = bl.oy + 0.015 * Math.cos(t * 3.7 + bl.ph);
        const R = bl.r * sc;
        const X = ccx + ox * sc, Y = ccy - oy * sc;
        const gv = clamp(bl.g + hgt * 28, 0, 225) | 0;
        ctx.fillStyle = `rgba(${gv},${gv},${gv},0.78)`;
        ctx.beginPath(); ctx.ellipse(X, Y, R * 1.15, R * 0.85, bl.ph, 0, Math.PI * 2); ctx.fill();
      }
      // ink contour hints and inner branches
      const lr = rng(tr.k * 31 + 3);
      ctx.strokeStyle = 'rgba(55,55,55,0.42)'; ctx.lineWidth = Math.max(0.8, 0.018 * s);
      for (let i = 0; i < 14; i++) {
        const a0 = lr() * Math.PI * 2, rr = (0.75 + lr() * 0.5);
        const X = ccx + Math.cos(a0) * rr * 1.2 * sc + 0.05 * sc * sway, Y = ccy - Math.sin(a0) * rr * 0.9 * sc;
        ctx.beginPath(); ctx.arc(X, Y, (0.18 + lr() * 0.2) * sc, a0 + 0.6, a0 + 2.2); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(70,70,70,0.55)'; ctx.lineWidth = Math.max(0.8, 0.03 * s);
      for (let i = 0; i < 4; i++) {
        const a0 = Math.PI * (0.25 + 0.5 * lr());
        ctx.beginPath(); ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(topX + Math.cos(a0) * 0.4 * sc, topY - 0.5 * sc, topX + Math.cos(a0) * 0.9 * sc + 0.04 * sc * sway, topY - (0.6 + lr() * 0.5) * sc); ctx.stroke();
      }
      // leaf flecks fluttering
      ctx.fillStyle = 'rgba(80,80,80,0.4)';
      for (let i = 0; i < 30; i++) {
        const a0 = lr() * 6.28, rr = Math.sqrt(lr()) * 1.3;
        const X = ccx + Math.cos(a0) * rr * sc + 0.03 * sc * Math.sin(t * 5 + i), Y = ccy - Math.sin(a0) * rr * 0.85 * sc;
        ctx.beginPath(); ctx.ellipse(X, Y, 0.035 * s, 0.017 * s, a0 + 0.4 * Math.sin(t * 3 + i), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // a few drifting leaves
    for (let i = 0; i < 7; i++) {
      const lr = rng(500 + i);
      const X0 = (lr() * 2 - 1) * 3, Z0 = WALL + 4 + lr() * 10, ph = lr() * 6;
      const tt = t - T_BURST;
      const X = X0 + 0.5 * Math.sin(tt * 0.9 + ph) + tt * 0.15, Y = 3.2 - ((tt * 0.35 + lr() * 3) % 3.2), Z = Z0;
      const [sx, sy, d] = proj(cam, X, Y, Z);
      if (d <= 0.6) continue;
      const s = FOC / d;
      ctx.fillStyle = 'rgba(80,80,80,0.6)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 0.06 * s, 0.025 * s, tt * 2 + ph, 0, Math.PI * 2); ctx.fill();
    }
      ctx0.save(); ctx0.filter = 'blur(0.7px)'; ctx0.drawImage(OL, 0, 0); ctx0.restore();
  }

  // ------------------------------------------------------------ draw boy
  function drawBoy(ctx, cam, p, boil) {
    const P = (q) => proj(cam, q.x, q.y, q.z);
    ctx.save();
    ctx.fillStyle = '#070707'; ctx.strokeStyle = '#070707';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const limb = (a, b, wa, wb) => {
      const A = P(a), B = P(b);
      const ra = FOC * wa / A[2] / 2, rb = FOC * wb / B[2] / 2;
      const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      ctx.beginPath();
      ctx.moveTo(A[0] + nx * ra, A[1] + ny * ra); ctx.lineTo(B[0] + nx * rb, B[1] + ny * rb);
      ctx.lineTo(B[0] - nx * rb, B[1] - ny * rb); ctx.lineTo(A[0] - nx * ra, A[1] - ny * ra); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(A[0], A[1], ra, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(B[0], B[1], rb, 0, 7); ctx.fill();
    };
    // legs
    for (const l of p.legs) {
      limb(l.hip, l.knee, 0.17, 0.12);
      limb(l.knee, l.ankle, 0.12, 0.075);
      limb(l.ankle, l.toe, 0.09, 0.085);
      const heel = add(l.ankle, v3(0, -0.035, -0.04));
      limb(heel, l.toe, 0.075, 0.07);
    }
    // torso (shoulders → hips), slightly tapered
    const sL = p.arms[0].sh, sR = p.arms[1].sh;
    const hL = add(p.P0, v3(-0.15, 0.02, 0)), hR = add(p.P0, v3(0.15, 0.02, 0));
    const wL = add(mix3(p.P0, p.SC, 0.55), v3(-0.15, 0, 0)), wR = add(mix3(p.P0, p.SC, 0.55), v3(0.15, 0, 0));
    const a = P(add(sL, v3(-0.04, -0.02, 0))), b = P(add(sR, v3(0.04, -0.02, 0)));
    const c = P(wR), d = P(hR), e = P(hL), f = P(wL);
    const top = P(add(p.SC, v3(0, 0.07, -0.02)));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(top[0], top[1] - (b[0] - a[0]) * 0.08, b[0], b[1]);
    ctx.quadraticCurveTo(c[0] + (b[0] - a[0]) * 0.05, (b[1] + c[1]) / 2, c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.quadraticCurveTo((d[0] + e[0]) / 2, Math.max(d[1], e[1]) + (b[0] - a[0]) * 0.1, e[0], e[1]);
    ctx.lineTo(f[0], f[1]);
    ctx.quadraticCurveTo(f[0] - (b[0] - a[0]) * 0.05, (a[1] + f[1]) / 2, a[0], a[1]);
    ctx.closePath(); ctx.fill();
    // shoulders (deltoids)
    for (const s of [sL, sR]) { const q = P(s); ctx.beginPath(); ctx.arc(q[0], q[1], FOC * 0.065 / q[2], 0, 7); ctx.fill(); }
    // arms
    for (const ar of p.arms) {
      limb(ar.sh, ar.el, 0.105, 0.085);
      limb(ar.el, ar.ha, 0.085, 0.07);
      const q = P(ar.ha); ctx.beginPath(); ctx.ellipse(q[0], q[1], FOC * 0.05 / q[2], FOC * 0.058 / q[2], 0, 0, 7); ctx.fill();
    }
    // neck & head
    limb(p.neck, add(p.head, v3(0, -0.05, 0)), 0.1, 0.1);
    const H = P(p.head), hs = FOC / H[2];
    ctx.beginPath(); ctx.ellipse(H[0], H[1], 0.104 * hs, 0.122 * hs, 0, 0, 7); ctx.fill();
    // ears
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(H[0] + s * 0.1 * hs, H[1] + 0.01 * hs, 0.022 * hs, 0.035 * hs, 0, 0, 7); ctx.fill(); }
    // a few soft hair locks on top of the head
    const hr = rng(77 + boil);
    for (let k = 0; k < 6; k++) {
      const a0 = -Math.PI * (0.22 + 0.56 * k / 5);
      const x0 = H[0] + Math.cos(a0) * 0.1 * hs, y0 = H[1] + Math.sin(a0) * 0.118 * hs;
      ctx.beginPath(); ctx.ellipse(x0, y0, (0.032 + hr() * 0.008) * hs, (0.02 + hr() * 0.006) * hs, a0 + Math.PI / 2 + 0.4, 0, 7); ctx.fill();
    }
    // hood lying on the back, below the head
    const nk = P(add(p.neck, v3(0, -0.04, -0.06)));
    const ns = FOC / nk[2];
    ctx.beginPath(); ctx.ellipse(nk[0], nk[1], 0.15 * ns, 0.075 * ns, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawShadow(ctx, cam, p, outside) {
    const [sx, sy, d] = proj(cam, p.P0.x, 0, p.zb + 0.08);
    if (d <= 0.3) return;
    const s = FOC / d;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 0.42 * s);
    const a = outside ? 0.22 : 0.26;
    g.addColorStop(0, `rgba(30,30,30,${a})`); g.addColorStop(1, 'rgba(30,30,30,0)');
    ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.32); ctx.translate(-sx, -sy);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 0.42 * s, 0, 7); ctx.fill(); ctx.restore();
    for (const l of p.legs) {
      const h = l.ankle.y - 0.075;
      if (h > 0.08) continue;
      const [fx, fy, fd] = proj(cam, l.ankle.x, 0, l.ankle.z + 0.06);
      const fs = FOC / fd;
      ctx.fillStyle = `rgba(20,20,20,${0.3 * (1 - h / 0.08)})`;
      ctx.beginPath(); ctx.ellipse(fx, fy, 0.07 * fs, 0.025 * fs, 0, 0, 7); ctx.fill();
    }
  }

  function drawDust(ctx, cam, t) {
    for (const e of EVENTS) {
      if (e.phase !== 'push' && e.phase !== 'burst') continue;
      const a = t - e.t;
      if (a < 0 || a > 0.75) continue;
      const r = rng(Math.round(e.t * 1000));
      for (let k = 0; k < 6; k++) {
        const ang = Math.PI * (0.8 + r() * 1.4);
        const dist = (0.05 + r() * 0.18) * (0.3 + a * 1.4);
        const X = e.x + Math.cos(ang) * dist * 0.8, Z = e.z - 0.05 - Math.abs(Math.sin(ang)) * dist, Y = 0.02 + a * 0.12 * r();
        const [sx, sy, d] = proj(cam, X, Y, Z);
        if (d <= 0.3) continue;
        const s = FOC / d;
        ctx.fillStyle = `rgba(90,90,90,${0.22 * (1 - a / 0.75)})`;
        ctx.beginPath(); ctx.arc(sx, sy, (0.025 + a * 0.06) * s, 0, 7); ctx.fill();
      }
    }
  }

  // ------------------------------------------------------------ the wall
  function drawWall(ctx, cam, t, p, hs, boil) {
    const S = relax(t);
    const caps = capsulesFromPose(t <= T_BURST ? p : pose(T_BURST));
    const N = NU * NV;
    const PX = new Float64Array(N), PY = new Float64Array(N), PD = new Float64Array(N), DEP = new Float64Array(N);
    const WX = new Float64Array(N), WY = new Float64Array(N), WZ = new Float64Array(N);
    let maxDep = 0;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const X = RX[i], Y = RY[j];
      const dep = sheetDepth(caps, X, Y) * S;
      let xx = X, yy = Y;
      if (hs && t > T_BURST) {   // rim recoil: material snaps outward from the tear
        const dx = X - hs.cx, dy = Y - hs.cy, r = Math.hypot(dx, dy) + 1e-6;
        const push = 0.55 * Math.max(hs.rx, 0.1) * Math.exp(-Math.max(0, r - hs.rx) / 1.1) * (1 - sstep(T_BURST + 0.6, T_BURST + 1.6, t));
        const wgt = sstep(hs.rx * 0.4, hs.rx * 0.95, r) * 0.35;
        xx += dx / r * push * wgt; if (Y > 0) yy = Math.max(0, yy + dy / r * push * wgt);
      }
      const k = j * NU + i;
      WX[k] = xx; WY[k] = yy; WZ[k] = WALL + dep; DEP[k] = dep;
      if (dep > maxDep) maxDep = dep;
      const pr = proj(cam, xx, yy, WALL + dep);
      PX[k] = pr[0]; PY[k] = pr[1]; PD[k] = pr[2];
    }
    // ---- floor: inside (white paper) below the rubber's bottom edge, tunnel floor shadow
    const bottom = [];
    for (let i = 0; i < NU; i++) if (PD[i] > 0.06) bottom.push([PX[i], PY[i], RX[i]]);
    if (hs) {
      const fl = new Path2D();
      fl.moveTo(-400, H_ + 400);
      for (const b of bottom) fl.lineTo(b[0], b[1]);
      fl.lineTo(W_ + 400, H_ + 400); fl.closePath();
      ctx.fillStyle = '#fbfbfa'; ctx.fill(fl);
    }
    // soft depth gradient on the white floor toward the wall
    {
      const yb = proj(cam, 0, 0, WALL)[1];
      const fg = ctx.createLinearGradient(0, yb - 10, 0, H_);
      fg.addColorStop(0, 'rgba(120,120,125,0.16)'); fg.addColorStop(0.18, 'rgba(120,120,125,0.05)'); fg.addColorStop(1, 'rgba(120,120,125,0)');
      ctx.fillStyle = fg; ctx.fillRect(0, yb - 10, W_, H_ - yb + 10);
    }
    if (maxDep > 0.02) {   // floor inside the stretched tunnel is shadowed by the rubber
      ctx.save();
      ctx.filter = 'blur(6px)';
      const sp = new Path2D();
      let first = true;
      for (let i = 0; i < NU; i++) { const pr = proj(cam, RX[i], 0, WALL); if (pr[2] < 0.06) continue; first ? sp.moveTo(pr[0], pr[1]) : sp.lineTo(pr[0], pr[1]); first = false; }
      for (let i = NU - 1; i >= 0; i--) if (PD[i] > 0.06) sp.lineTo(PX[i], PY[i]);
      sp.closePath();
      const yb0 = proj(cam, 0, 0, WALL)[1], yb1 = PY[(NU - 1) >> 1];
      const tg = ctx.createLinearGradient(0, yb0, 0, Math.min(yb0 - 1, yb1));
      const ta = 0.5 * clamp(maxDep, 0, 1) * clamp(S + 0.1, 0, 1);
      tg.addColorStop(0, `rgba(40,60,110,${ta * 0.35})`); tg.addColorStop(1, `rgba(20,35,80,${ta})`);
      ctx.fillStyle = tg; ctx.fill(sp);
      ctx.restore();
    }

    // ---- rubber quads into an offscreen layer
    const QC = layer('q'), qx = QC.getContext('2d');
    qx.setTransform(1, 0, 0, 1, 0, 0); qx.clearRect(0, 0, W_, H_);
    const quads = [];
    const L = [-0.35, 0.55, -0.76].map((v, _, a) => v / Math.hypot(...a));
    for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) {
      const k0 = j * NU + i, k1 = k0 + 1, k2 = k0 + NU + 1, k3 = k0 + NU;
      if (PD[k0] < 0.06 || PD[k1] < 0.06 || PD[k2] < 0.06 || PD[k3] < 0.06) continue;
      const xs = [PX[k0], PX[k1], PX[k2], PX[k3]], ys = [PY[k0], PY[k1], PY[k2], PY[k3]];
      if (Math.max(...xs) < -20 || Math.min(...xs) > W_ + 20 || Math.max(...ys) < -20 || Math.min(...ys) > H_ + 20) continue;
      const ax = WX[k2] - WX[k0], ay = WY[k2] - WY[k0], az = WZ[k2] - WZ[k0];
      const bx = WX[k3] - WX[k1], by = WY[k3] - WY[k1], bz = WZ[k3] - WZ[k1];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const restA = (RX[i + 1] - RX[i]) * (RY[j + 1] - RY[j]);
      const stretch = clamp((nl * 0.5 / restA - 1) * 0.06, 0, 0.3);
      const dep = (DEP[k0] + DEP[k2]) / 2;
      const ao = 1 - 0.3 * clamp(dep / 3.2, 0, 1);
      const sh = (0.32 + 0.9 * lam) * ao;
      let r = 44 * sh, g = 92 * sh, b = 176 * sh + 6;
      r = lerp(r, 150, stretch); g = lerp(g, 186, stretch); b = lerp(b, 236, stretch);
      quads.push({ d: (PD[k0] + PD[k2]) / 2, xs, ys, c: `rgb(${r | 0},${g | 0},${b | 0})` });
    }
    quads.sort((a, b) => b.d - a.d);
    qx.lineJoin = 'round';
    for (const q of quads) {
      qx.fillStyle = q.c; qx.strokeStyle = q.c; qx.lineWidth = 1;
      qx.beginPath(); qx.moveTo(q.xs[0], q.ys[0]); qx.lineTo(q.xs[1], q.ys[1]); qx.lineTo(q.xs[2], q.ys[2]); qx.lineTo(q.xs[3], q.ys[3]); qx.closePath();
      qx.fill(); qx.stroke();
    }
    const WC = layer('w'), wx = WC.getContext('2d');
    wx.setTransform(1, 0, 0, 1, 0, 0); wx.clearRect(0, 0, W_, H_);
    wx.filter = 'blur(1.6px)'; wx.drawImage(QC, 0, 0); wx.filter = 'none';
    // charcoal hatch texture, only on rubber pixels
    wx.globalCompositeOperation = 'source-atop';
    wx.globalAlpha = 0.5;
    wx.fillStyle = wx.createPattern(HATCH, 'repeat');
    wx.save(); wx.translate((boil % 3) * 7, (boil % 2) * 5); wx.fillRect(-50, -50, W_ + 100, H_ + 100); wx.restore();
    wx.globalAlpha = 1;
    // ink grid + tension lines
    const jr = rng(boil * 13 + 5);
    wx.lineCap = 'round'; wx.lineJoin = 'round';
    const line = (pts, style, w) => {
      wx.strokeStyle = style; wx.lineWidth = w; wx.beginPath();
      let pen = false;
      for (const [x, y, d] of pts) {
        if (d < 0.08) { pen = false; continue; }
        const jx = x + (jr() - 0.5) * 1.4, jy = y + (jr() - 0.5) * 1.4;
        if (!pen) { wx.moveTo(jx, jy); pen = true; } else wx.lineTo(jx, jy);
      }
      wx.stroke();
    };
    for (let i = 3; i < NU; i += 6) { const pts = []; for (let j = 0; j < NV; j++) { const k = j * NU + i; pts.push([PX[k], PY[k], PD[k]]); } line(pts, 'rgba(10,28,70,0.22)', 1.3); }
    for (let j = 2; j < NV; j += 5) { const pts = []; for (let i = 0; i < NU; i++) { const k = j * NU + i; pts.push([PX[k], PY[k], PD[k]]); } line(pts, 'rgba(10,28,70,0.22)', 1.3); }
    const ten = clamp(maxDep / 1.4, 0, 1);
    if (ten > 0.02) {
      const cx = p.P0.x * 0.5, cy = 1.3;
      for (let k = 0; k < 24; k++) {
        const th = k / 24 * Math.PI * 2 + 0.13 * Math.sin(k * 3.7);
        const pts = [], pts2 = [];
        for (let m = 0; m < 40; m++) {
          const rr = 0.2 + Math.pow(m / 39, 1.4) * 4.4;
          const X = cx + Math.cos(th) * rr, Y = cy + Math.sin(th) * rr * 0.9;
          if (Y < 0) break;
          const dep = sheetDepth(caps, X, Y) * S;
          const pr = proj(cam, X, Y, WALL + dep), pr2 = proj(cam, X + 0.035, Y + 0.035, WALL + dep);
          pts.push(pr); pts2.push(pr2);
        }
        line(pts, `rgba(6,18,52,${0.4 * ten})`, 1.8);
        line(pts2, `rgba(190,215,255,${0.28 * ten})`, 1.1);
      }
    }
    wx.globalCompositeOperation = 'source-over';
    // bottom contact line
    wx.strokeStyle = 'rgba(8,20,50,0.55)'; wx.lineWidth = 1.8; wx.beginPath();
    bottom.forEach((b, n) => n ? wx.lineTo(b[0], b[1]) : wx.moveTo(b[0], b[1])); wx.stroke();
    // tear the hole out of the rubber layer
    let rim = null;
    if (hs) {
      rim = holeRim(cam, hs, caps, S);
      if (rim) {
        wx.globalCompositeOperation = 'destination-out';
        wx.fillStyle = '#000'; wx.fill(rim.path);
        wx.globalCompositeOperation = 'source-over';
      }
    }
    // soft wall shadow on the floor
    ctx.save(); ctx.strokeStyle = 'rgba(40,40,55,0.3)'; ctx.lineWidth = 10; ctx.filter = 'blur(7px)';
    ctx.beginPath(); bottom.forEach((b, n) => n ? ctx.lineTo(b[0], b[1] + 4) : ctx.moveTo(b[0], b[1] + 4)); ctx.stroke(); ctx.restore();
    ctx.drawImage(WC, 0, 0);
    if (rim) {   // torn rubber edge: thickness + ink line (not along the floor)
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const [style, w] of [['rgba(6,16,45,0.85)', 14], ['rgba(130,170,228,1)', 9], ['rgba(6,16,45,0.95)', 2.6]]) {
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
        let pen = false;
        for (const q of rim.pts) { if (q[3]) { pen = false; continue; } if (!pen) { ctx.moveTo(q[0], q[1]); pen = true; } else ctx.lineTo(q[0], q[1]); }
        ctx.stroke();
      }
      ctx.restore();
    }
    return { caps, S, rim };
  }

  function holeRim(cam, hs, caps, S) {
    const N = 160, path = new Path2D(), pts = [];
    for (let k = 0; k <= N; k++) {
      const th = k / N * Math.PI * 2;
      const rr = holeR(th);
      const X = hs.cx + Math.cos(th) * hs.rx * rr;
      let Y = hs.cy + Math.sin(th) * hs.ry * rr;
      const onFloor = Y < 0.02;
      Y = Math.max(0, Y);
      const dep = sheetDepth(caps, X, Y) * S;
      const [sx, sy, d] = proj(cam, X, Y, WALL + dep);
      if (d < 0.06) return null;
      if (k === 0) path.moveTo(sx, sy); else path.lineTo(sx, sy);
      pts.push([sx, sy, d, onFloor]);
    }
    path.closePath();
    return { path, pts };
  }
  const LAYERS = {};
  function layer(name) {
    if (!LAYERS[name]) { const c = document.createElement('canvas'); c.width = W_; c.height = H_; LAYERS[name] = c; }
    return LAYERS[name];
  }

  // ------------------------------------------------------------- frame
  function renderFrame(ctx, f) {
    makeTextures();
    const t = f / FPS;
    const boil = Math.floor(f / 2);
    const p = pose(t);
    const cam = camera(t, p);
    const hs = holeShape(t, p);
    const fullyOut = cam.z > WALL - 0.25;

    // inner void: white paper floor
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.fillStyle = '#fbfbfa'; ctx.fillRect(0, 0, W_, H_);

    if (fullyOut) {
      drawOutside(ctx, cam, t);
    } else {
      if (hs) drawOutside(ctx, cam, t);
      const wr = drawWall(ctx, cam, t, p, hs, boil);
      if (wr.rim) {
        // light pouring through the opening
        const lp = t < T_BURST ? 0.85 : Math.max(0, 0.45 - (t - T_BURST) * 0.9);
        ctx.save(); ctx.clip(wr.rim.path);
        if (lp > 0) { ctx.fillStyle = `rgba(255,255,255,${lp})`; ctx.fillRect(0, 0, W_, H_); }
        ctx.restore();
        if (t < T_BURST + 0.4) {
          const hb = proj(cam, hs.cx, hs.cy, WALL + sheetDepth(wr.caps, hs.cx, hs.cy) * wr.S);
          const gl = ctx.createRadialGradient(hb[0], hb[1], 0, hb[0], hb[1], 200);
          const ga = t < T_BURST ? 0.6 * sstep(T_CRACK, T_BURST, t) : 0.6 * (1 - (t - T_BURST) / 0.4);
          gl.addColorStop(0, `rgba(255,255,255,${ga})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gl; ctx.fillRect(hb[0] - 210, hb[1] - 210, 420, 420);
        }
      }
    }
    drawDust(ctx, cam, t);
    // scribbles behind the boy (further from camera), then boy, then nearer scribbles
    for (const s of SCRIB) drawScribble(ctx, cam, s, t, p, boil, false);
    drawShadow(ctx, cam, p, fullyOut || t > T_BURST + 0.4);
    drawBoy(ctx, cam, p, boil);
    for (const s of SCRIB) drawScribble(ctx, cam, s, t, p, boil, true);

    // flash at the burst
    if (t > T_BURST && t < T_BURST + 0.6) {
      ctx.fillStyle = `rgba(255,255,255,${0.18 * (1 - (t - T_BURST) / 0.6)})`; ctx.fillRect(0, 0, W_, H_);
    }
    // charcoal vignette: heavy inside, airy outside
    const vin = lerp(0.3, 0.1, sstep(T_BURST, T_BURST + 1.6, t)) + 0.08 * sstep(6, 10.3, t) * (1 - sstep(T_BURST, T_BURST + 0.5, t));
    const vg = ctx.createRadialGradient(W_ / 2, H_ * 0.45, H_ * 0.3, W_ / 2, H_ * 0.45, H_ * 0.75);
    vg.addColorStop(0, 'rgba(20,20,20,0)'); vg.addColorStop(1, `rgba(20,20,20,${vin})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W_, H_);
    // paper grain
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(GRAIN[boil % 3], 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // closing caption
    if (t >= 12.0) {
      const u = sstep(12.0, 12.45, t);
      ctx.save();
      ctx.globalAlpha = u;
      ctx.direction = 'rtl';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = '700 74px "HebFont", "Liberation Sans", sans-serif';
      ctx.filter = u < 1 ? `blur(${(1 - u) * 6}px)` : 'none';
      const dy = (1 - u) * 16;
      ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 26;
      ctx.fillStyle = '#0b0b0b';
      ctx.fillText(TEXT_LINES[0], W_ / 2, 330 + dy);
      ctx.fillText(TEXT_LINES[1], W_ / 2, 440 + dy);
      ctx.restore();
    }
  }

  global.RubberWall = { W: W_, H: H_, FPS, DUR, NF, renderFrame, EVENTS, T_BURST, T_CRACK,
    debug: { pose, camera, TL, idx, keyf, holeShape, relax, sheetDepth, capsulesFromPose, proj, Z_OFFSET: () => Z_OFFSET } };
})(typeof window !== 'undefined' ? window : globalThis);
