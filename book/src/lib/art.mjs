/**
 * Art engine used by Agent Visual.
 *
 * Every illustration in the book is produced here as inline SVG so the book is
 * visually complete on its own. Each archetype also ships with a matching
 * text-to-image prompt (see agents/visual.mjs) for studio-grade re-rendering.
 *
 * Direction: flat geometric vector, gaming-HUD language, thick strokes,
 * committed palette, no photoreal gradients, no drop shadows.
 */

export const PALETTE = {
  ink: '#14161F',
  panel: '#161E33',
  panelDeep: '#0E1424',
  paper: '#FAF6EE',
  violet: '#6A4BFF',
  violetSoft: '#9C86FF',
  lime: '#B8FF3C',
  coral: '#FF5A5F',
  teal: '#19C4B2',
  gold: '#FFB020',
  slate: '#5A6480',
};

const P = PALETTE;

/* ── helpers ─────────────────────────────────────────────────────────── */

export function rng(seed) {
  let s = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Text node with VISUAL anchoring.
 *
 * `text-anchor` follows the writing direction, so in RTL `end` aligns to the
 * left. Call sites here think in visual terms — anchor:'end' means "the text
 * sits to the left of x, flush right at x" — so the mapping is swapped for RTL
 * and the direction is always stated explicitly (never inherited from the page).
 */
function t(x, y, str, o = {}) {
  const {
    size = 20, weight = 800, fill = P.paper, anchor = 'middle',
    family = "'Heebo','Arial Hebrew',sans-serif", opacity = 1, letter = 0, rtl = true,
  } = o;
  const swap = { start: 'end', end: 'start', middle: 'middle' };
  const resolved = rtl ? swap[anchor] || 'middle' : anchor;
  return `<text x="${x}" y="${y}" text-anchor="${resolved}" fill="${fill}" opacity="${opacity}"
    font-family="${family}" font-size="${size}" font-weight="${weight}"
    letter-spacing="${letter}" direction="${rtl ? 'rtl' : 'ltr'}">${esc(str)}</text>`;
}

function grid(w, h, step = 40, color = '#FFFFFF', op = 0.05) {
  let d = '';
  for (let x = step; x < w; x += step) d += `M${x} 0V${h}`;
  for (let y = step; y < h; y += step) d += `M0 ${y}H${w}`;
  return `<path d="${d}" stroke="${color}" stroke-opacity="${op}" stroke-width="1"/>`;
}

function brackets(w, h, color = P.lime, len = 26, inset = 14, sw = 4) {
  const c = [
    `M${inset} ${inset + len}V${inset}H${inset + len}`,
    `M${w - inset - len} ${inset}H${w - inset}V${inset + len}`,
    `M${w - inset} ${h - inset - len}V${h - inset}H${w - inset - len}`,
    `M${inset + len} ${h - inset}H${inset}V${h - inset - len}`,
  ];
  return c
    .map((d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="square"/>`)
    .join('');
}

function panel(w, h, fill = P.panel) {
  return `<rect width="${w}" height="${h}" rx="0" fill="${fill}"/>${grid(w, h)}`;
}

function chip(x, y, label, o = {}) {
  const { fill = P.lime, color = P.ink, w = 118, h = 34, size = 16 } = o;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>
    ${t(x + w / 2, y + h / 2 + size * 0.36, label, { size, fill: color, weight: 800 })}</g>`;
}

function coin(cx, cy, r, o = {}) {
  const { face = P.gold, edge = '#C8801A', mark = '₪' } = o;
  return `<g>
    <ellipse cx="${cx}" cy="${cy + r * 0.16}" rx="${r}" ry="${r}" fill="${edge}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${face}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="none" stroke="${edge}" stroke-width="${r * 0.12}" stroke-opacity="0.55"/>
    ${t(cx, cy + r * 0.38, mark, { size: r * 1.05, fill: edge, rtl: false })}
  </g>`;
}

/** A pile of currency, drawn as stacked discs — game-loot language. */
function coinStack(cx, baseY, count, r, o = {}) {
  const { face = P.gold, edge = '#C8801A', step = r * 0.34, mark = false } = o;
  let out = '';
  for (let i = 0; i < count; i++) {
    const y = baseY - i * step;
    out += `<ellipse cx="${cx}" cy="${y}" rx="${r}" ry="${r * 0.36}" fill="${edge}"/>
      <ellipse cx="${cx}" cy="${y - step * 0.34}" rx="${r}" ry="${r * 0.36}" fill="${face}"/>`;
  }
  if (mark) {
    const top = baseY - (count - 1) * step - step * 0.34;
    out += `<ellipse cx="${cx}" cy="${top}" rx="${r * 0.6}" ry="${r * 0.22}" fill="none"
      stroke="${edge}" stroke-width="${r * 0.09}" stroke-opacity="0.6"/>`;
  }
  return `<g>${out}</g>`;
}

/** Blocky teen avatar: a head, a hoodie torso, no faces beyond simple marks. */
function avatar(cx, cy, s, o = {}) {
  const { hoodie = P.violet, skin = '#F2C49B', hair = '#241C2E', mood = 'calm' } = o;
  const eye = (dx) =>
    mood === 'shock'
      ? `<circle cx="${cx + dx}" cy="${cy - s * 0.12}" r="${s * 0.07}" fill="${P.ink}"/>`
      : `<rect x="${cx + dx - s * 0.06}" y="${cy - s * 0.16}" width="${s * 0.12}" height="${s * 0.07}" rx="${s * 0.035}" fill="${P.ink}"/>`;
  const mouth =
    mood === 'happy'
      ? `<path d="M${cx - s * 0.13} ${cy + s * 0.06}q${s * 0.13} ${s * 0.14} ${s * 0.26} 0" stroke="${P.ink}" stroke-width="${s * 0.05}" fill="none" stroke-linecap="round"/>`
      : mood === 'shock'
      ? `<ellipse cx="${cx}" cy="${cy + s * 0.1}" rx="${s * 0.08}" ry="${s * 0.1}" fill="${P.ink}"/>`
      : `<path d="M${cx - s * 0.12} ${cy + s * 0.09}h${s * 0.24}" stroke="${P.ink}" stroke-width="${s * 0.05}" stroke-linecap="round"/>`;
  return `<g>
    <path d="M${cx - s * 0.72} ${cy + s * 1.5}v-${s * 0.5}a${s * 0.72} ${s * 0.72} 0 0 1 ${s * 1.44} 0v${s * 0.5}z" fill="${hoodie}"/>
    <rect x="${cx - s * 0.16}" y="${cy + s * 0.42}" width="${s * 0.32}" height="${s * 0.3}" fill="${skin}"/>
    <rect x="${cx - s * 0.52}" y="${cy - s * 0.62}" width="${s * 1.04}" height="${s * 1.16}" rx="${s * 0.34}" fill="${skin}"/>
    <path d="M${cx - s * 0.54} ${cy - s * 0.2}v-${s * 0.24}a${s * 0.54} ${s * 0.54} 0 0 1 ${s * 1.08} 0v${s * 0.24}q-${s * 0.2} -${s * 0.22} -${s * 0.54} -${s * 0.2}q-${s * 0.34} -0.02 -${s * 0.54} ${s * 0.2}z" fill="${hair}"/>
    ${eye(-s * 0.2)}${eye(s * 0.2)}${mouth}
  </g>`;
}

function bubble(x, y, w, h, text, o = {}) {
  const { fill = P.paper, color = P.ink, size = 19, tail = 'br', stroke = 'none' } = o;
  const tails = {
    br: `M${x + w * 0.62} ${y + h}l0 ${h * 0.34}l${-w * 0.2} ${-h * 0.34}z`,
    bl: `M${x + w * 0.38} ${y + h}l0 ${h * 0.34}l${w * 0.2} ${-h * 0.34}z`,
  };
  const lines = String(text).split('|');
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(22, h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <path d="${tails[tail]}" fill="${fill}"/>
    ${lines
      .map((l, i) =>
        t(x + w / 2, y + h / 2 + size * 0.36 - ((lines.length - 1) * size * 0.72) / 2 + i * size * 1.44, l, {
          size, fill: color, weight: 700,
        })
      )
      .join('')}
  </g>`;
}

function bar(x, y, w, h, pct, o = {}) {
  const { fill = P.lime, track = '#FFFFFF18', r = h / 2 } = o;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${track}"/>
    <rect x="${x + w * (1 - pct)}" y="${y}" width="${w * pct}" height="${h}" rx="${r}" fill="${fill}"/></g>`;
}

function donutSlice(cx, cy, r, r0, from, to, fill) {
  const rad = (a) => ((a - 90) * Math.PI) / 180;
  const p = (radius, a) => [cx + radius * Math.cos(rad(a)), cy + radius * Math.sin(rad(a))];
  const [x1, y1] = p(r, from), [x2, y2] = p(r, to);
  const [x3, y3] = p(r0, to), [x4, y4] = p(r0, from);
  const large = to - from > 180 ? 1 : 0;
  return `<path d="M${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${r0} ${r0} 0 ${large} 0 ${x4} ${y4}Z" fill="${fill}"/>`;
}

/* ── archetypes ──────────────────────────────────────────────────────── */

const SCENES = {
  /* 1. cover */
  cover(w, h, c) {
    const cx = w / 2, ground = h * 0.68;
    const disc = Math.min(w, h) * 0.36;
    const stacks = [
      { dx: -w * 0.19, n: 5, r: 44 },
      { dx: -w * 0.065, n: 9, r: 48 },
      { dx: w * 0.065, n: 6, r: 46 },
      { dx: w * 0.19, n: 3, r: 42 },
    ];
    return `${panel(w, h, P.panelDeep)}
      <circle cx="${cx}" cy="${h * 0.5}" r="${disc}" fill="${P.violet}" opacity="0.2"/>
      <circle cx="${cx}" cy="${h * 0.5}" r="${disc}" fill="none" stroke="${P.violetSoft}"
        stroke-width="2" stroke-opacity="0.3" stroke-dasharray="3 13"/>
      <!-- the funds readout is drawn by the page as a live layer over this art -->
      <path d="M${cx - w * 0.3} ${ground + 16}H${cx + w * 0.3}" stroke="${P.violetSoft}"
        stroke-width="3" stroke-opacity="0.35" stroke-linecap="round"/>
      ${stacks.map((st) => coinStack(cx + st.dx, ground, st.n, st.r, { mark: st.n > 5 })).join('')}
      ${coin(cx + w * 0.29, h * 0.36, 30)}
      ${coin(cx - w * 0.3, h * 0.3, 24)}
      ${chip(cx - 104, h * 0.85, c.tag || 'START', { w: 208, h: 46, size: 18, fill: P.coral, color: P.paper })}
      ${brackets(w, h, P.lime, 46, 22, 5)}`;
  },

  /* 2. allocation donut */
  hudPie(w, h, c) {
    const cx = w * 0.32, cy = h / 2, r = Math.min(w, h) * 0.33, r0 = r * 0.58;
    const parts = c.parts || [
      { pct: 40, label: 'חופשה', color: P.lime },
      { pct: 30, label: 'חירום', color: P.coral },
      { pct: 20, label: 'עתיד', color: P.violetSoft },
      { pct: 10, label: 'כיף', color: P.gold },
    ];
    let a = 0;
    const slices = parts
      .map((p) => {
        const s = donutSlice(cx, cy, r, r0, a + 1.5, a + (p.pct / 100) * 360 - 1.5, p.color);
        a += (p.pct / 100) * 360;
        return s;
      })
      .join('');
    // Right-aligned label column, then the swatch, then the number — all in
    // absolute coordinates so a long Hebrew label can never reach the swatch.
    const labelX = w - 40, swatchX = w * 0.56, pctX = swatchX - 16;
    const legend = parts
      .map((p, i) => {
        const y = cy - ((parts.length - 1) * 52) / 2 + i * 52;
        return `<g>
        <rect x="${swatchX}" y="${y - 15}" width="30" height="30" rx="8" fill="${p.color}"/>
        ${t(labelX, y + 8, p.label, { size: 22, anchor: 'end', fill: P.paper })}
        ${t(pctX, y + 8, `${p.pct}%`, { size: 22, anchor: 'end', fill: p.color, rtl: false })}</g>`;
      })
      .join('');
    return `${panel(w, h)}${slices}
      ${t(cx, cy - 4, c.center || '5,000', { size: r * 0.42, fill: P.paper, weight: 900, rtl: false })}
      ${t(cx, cy + r * 0.34, '₪', { size: r * 0.26, fill: P.slate, rtl: false })}
      ${legend}${brackets(w, h)}`;
  },

  /* 3. four wallets */
  wallets(w, h, c) {
    const items = c.items || [];
    const gap = 22, cw = (w - gap * 5) / 4, cy = h * 0.5, ch = h * 0.56;
    return `${panel(w, h)}${items
      .map((it, i) => {
        const x = w - gap - cw - i * (cw + gap);
        return `<g>
          <rect x="${x}" y="${cy - ch / 2}" width="${cw}" height="${ch}" rx="18" fill="${P.panelDeep}" stroke="${it.color}" stroke-width="3"/>
          <rect x="${x}" y="${cy - ch / 2}" width="${cw}" height="${ch * 0.3}" rx="18" fill="${it.color}"/>
          <rect x="${x + cw * 0.5 - 18}" y="${cy - ch * 0.06}" width="36" height="26" rx="6" fill="${it.color}"/>
          ${t(x + cw / 2, cy - ch / 2 + ch * 0.2, it.label, { size: 19, fill: P.ink, weight: 900 })}
          ${t(x + cw / 2, cy + ch * 0.28, it.amount, { size: 27, fill: it.color, weight: 900, rtl: false })}
          ${t(x + cw / 2, cy + ch * 0.42, it.note || '', { size: 14, fill: P.slate })}
        </g>`;
      })
      .join('')}${brackets(w, h)}`;
  },

  /* 4. comic character panel */
  scene(w, h, c) {
    const r = rng(c.seed || 'scene');
    return `${panel(w, h)}
      <circle cx="${w * 0.28}" cy="${h * 0.5}" r="${h * 0.36}" fill="${c.color || P.violet}" opacity="0.22"/>
      ${avatar(w * 0.28, h * 0.42, h * 0.2, { hoodie: c.color || P.violet, mood: c.mood || 'calm' })}
      ${bubble(w * 0.44, h * 0.16, w * 0.48, h * 0.3, c.say || '', { tail: 'bl' })}
      ${c.prop ? SCENE_PROPS[c.prop](w, h, c, r) : ''}
      ${chip(w * 0.44, h * 0.72, c.tag || '', { w: w * 0.3, h: 38, size: 16, fill: P.lime })}
      ${brackets(w, h)}`;
  },

  /* 5. boss health bar */
  boss(w, h, c) {
    const bars = c.bars || [];
    return `${panel(w, h)}
      <g>${bars
        .map((b, i) => {
          const y = h * 0.2 + i * (h * 0.17);
          return `<g>
          ${t(w - 34, y + 6, b.label, { size: 21, anchor: 'end', fill: P.paper })}
          ${bar(34, y - 16, w * 0.52, 26, b.pct, { fill: b.color })}
          ${t(34 + w * 0.52 - 10, y + 6, b.value || '', { size: 17, anchor: 'end', fill: P.ink, weight: 900, rtl: false })}
        </g>`;
        })
        .join('')}</g>
      ${t(w / 2, h * 0.11, c.title || '', { size: 24, fill: P.coral, weight: 900 })}
      ${brackets(w, h, P.coral)}`;
  },

  /* 6. snowball growth */
  snowball(w, h, c) {
    const pts = c.points || [1000, 1070, 1403, 1967];
    const max = Math.max(...pts) * 1.12;
    const x = (i) => w - 80 - (i * (w - 160)) / (pts.length - 1);
    const y = (v) => h * 0.82 - (v / max) * h * 0.58;
    const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join('');
    return `${panel(w, h)}
      <path d="${path}L${x(pts.length - 1)} ${h * 0.82}L${x(0)} ${h * 0.82}Z" fill="${P.teal}" opacity="0.2"/>
      <path d="${path}" fill="none" stroke="${P.teal}" stroke-width="5" stroke-linejoin="round"/>
      ${pts
        .map(
          (v, i) => `<g><circle cx="${x(i)}" cy="${y(v)}" r="${8 + i * 5}" fill="${P.paper}" stroke="${P.teal}" stroke-width="4"/>
        ${t(x(i), y(v) - 24 - i * 3, v.toLocaleString('en-US'), { size: 17, fill: P.lime, weight: 800, rtl: false })}
        ${t(x(i), h * 0.92, (c.labels || [])[i] || '', { size: 15, fill: P.slate })}</g>`
        )
        .join('')}
      <path d="M34 ${h * 0.82}H${w - 34}" stroke="${P.slate}" stroke-width="2"/>
      ${t(w - 40, h * 0.14, c.title || '', { size: 22, anchor: 'end', fill: P.paper })}
      ${brackets(w, h, P.teal)}`;
  },

  /* 7. 48h timer */
  timer(w, h, c) {
    const cx = w / 2, cy = h * 0.48, r = Math.min(w, h) * 0.28;
    return `${panel(w, h)}
      <circle cx="${cx}" cy="${cy}" r="${r + 16}" fill="none" stroke="${P.slate}" stroke-width="2" stroke-dasharray="6 10"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.panelDeep}" stroke="${P.gold}" stroke-width="6"/>
      ${donutSlice(cx, cy, r, r - 14, 0, 250, P.gold)}
      ${t(cx, cy + r * 0.16, c.big || '48', { size: r * 0.9, fill: P.paper, weight: 900, rtl: false })}
      ${t(cx, cy + r * 0.52, c.unit || 'שעות', { size: r * 0.22, fill: P.gold, weight: 800 })}
      ${t(cx, h * 0.9, c.caption || '', { size: 20, fill: P.paper })}
      ${brackets(w, h, P.gold)}`;
  },

  /* 8. want vs need split */
  versus(w, h, c) {
    const halves = [
      { x: w / 2, label: c.left || 'צריך', color: P.teal, items: c.leftItems || [] },
      { x: 0, label: c.right || 'רוצה', color: P.coral, items: c.rightItems || [] },
    ];
    return `${panel(w, h)}
      ${halves
        .map(
          (hf) => `<g>
        <rect x="${hf.x + 18}" y="18" width="${w / 2 - 36}" height="${h - 36}" rx="16" fill="${hf.color}" opacity="0.14"/>
        ${t(hf.x + w / 4, 70, hf.label, { size: 26, fill: hf.color, weight: 900 })}
        ${hf.items
          .map((it, i) => t(hf.x + w / 4, 118 + i * 38, it, { size: 19, fill: P.paper, opacity: 0.9 }))
          .join('')}
      </g>`
        )
        .join('')}
      <path d="M${w / 2} 30V${h - 30}" stroke="${P.slate}" stroke-width="2" stroke-dasharray="8 8"/>
      <circle cx="${w / 2}" cy="${h / 2}" r="30" fill="${P.ink}" stroke="${P.lime}" stroke-width="3"/>
      ${t(w / 2, h / 2 + 8, 'VS', { size: 20, fill: P.lime, weight: 900, rtl: false })}
      ${brackets(w, h)}`;
  },

  /* 9. inventory grid */
  inventory(w, h, c) {
    const cols = c.cols || 5, rows = c.rows || 2;
    const items = c.items || [];
    const gap = 16;
    const cw = (w - gap * (cols + 1)) / cols;
    const chh = Math.min(cw, (h - 90 - gap * (rows + 1)) / rows);
    return `${panel(w, h)}
      ${t(w - 30, 50, c.title || '', { size: 22, anchor: 'end', fill: P.paper })}
      ${Array.from({ length: cols * rows })
        .map((_, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const x = w - gap - cw - col * (cw + gap);
          const y = 76 + gap + row * (chh + gap);
          const it = items[i];
          return `<g><rect x="${x}" y="${y}" width="${cw}" height="${chh}" rx="14"
            fill="${it ? P.panelDeep : '#FFFFFF08'}" stroke="${it ? it.color || P.violetSoft : '#FFFFFF18'}" stroke-width="3"/>
            ${it ? t(x + cw / 2, y + chh * 0.58, it.label, { size: Math.min(17, cw / 5.6), fill: P.paper }) : ''}
            ${it && it.badge ? chip(x + cw - 46, y + 8, it.badge, { w: 40, h: 22, size: 12, fill: it.color || P.lime }) : ''}
          </g>`;
        })
        .join('')}
      ${brackets(w, h)}`;
  },

  /* 10. stacking small expenses */
  stack(w, h, c) {
    const vals = c.values || [30, 45, 70, 25];
    const total = vals.reduce((a, b) => a + b, 0);
    const baseY = h * 0.8, maxH = h * 0.52;
    const unit = maxH / total;
    const bw = 62, gap = 30;
    const rightEdge = w - 60;
    const totalW = 92;
    const eqX = rightEdge - vals.length * (bw + gap) - 18;

    const bars = vals
      .map((v, i) => {
        const x = rightEdge - bw - i * (bw + gap);
        const bh = Math.max(30, v * unit);
        return `<g><rect x="${x}" y="${baseY - bh}" width="${bw}" height="${bh}" rx="10" fill="${P.violetSoft}"/>
          ${t(x + bw / 2, baseY - bh - 14, String(v), { size: 19, fill: P.paper, weight: 800, rtl: false })}
          ${i < vals.length - 1 ? t(x - gap / 2, baseY - 24, '+', { size: 26, fill: P.slate, weight: 900, rtl: false }) : ''}
        </g>`;
      })
      .join('');

    return `${panel(w, h)}
      ${t(w - 34, 52, c.title || '', { size: 23, anchor: 'end', fill: P.paper })}
      ${bars}
      ${t(eqX, baseY - 24, '=', { size: 30, fill: P.lime, weight: 900, rtl: false })}
      <g><rect x="${eqX - 26 - totalW}" y="${baseY - maxH}" width="${totalW}" height="${maxH}" rx="12" fill="${P.coral}"/>
        ${t(eqX - 26 - totalW / 2, baseY - maxH - 16, `${total} ₪`, { size: 24, fill: P.coral, weight: 900, rtl: false })}</g>
      <path d="M60 ${baseY}H${rightEdge}" stroke="${P.slate}" stroke-width="2"/>
      ${brackets(w, h, P.coral)}`;
  },

  /* 11. phone checklist UI */
  phone(w, h, c) {
    const pw = Math.min(w * 0.42, h * 0.62), ph = pw * 1.72;
    const px = w * 0.5 - pw / 2, py = h / 2 - ph / 2;
    const rows = c.rows || [];
    return `${panel(w, h)}
      <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="30" fill="${P.paper}" stroke="${P.violet}" stroke-width="5"/>
      <rect x="${px + pw * 0.32}" y="${py + 12}" width="${pw * 0.36}" height="10" rx="5" fill="${P.slate}" opacity="0.4"/>
      ${t(px + pw - 20, py + 58, c.title || '', { size: 17, anchor: 'end', fill: P.ink, weight: 900 })}
      ${rows
        .map((r, i) => {
          const y = py + 84 + i * 46;
          return `<g><rect x="${px + 14}" y="${y}" width="${pw - 28}" height="36" rx="10" fill="${P.ink}" opacity="0.06"/>
          <rect x="${px + pw - 46}" y="${y + 8}" width="20" height="20" rx="6" fill="${r.on ? P.teal : 'none'}" stroke="${P.ink}" stroke-width="2" opacity="${r.on ? 1 : 0.4}"/>
          ${r.on ? `<path d="M${px + pw - 41} ${y + 18}l4 5l8 -9" stroke="${P.paper}" stroke-width="3" fill="none" stroke-linecap="round"/>` : ''}
          ${t(px + pw - 56, y + 24, r.label, { size: 14, anchor: 'end', fill: P.ink, weight: 700 })}</g>`;
        })
        .join('')}
      ${c.foot ? chip(px + pw / 2 - 70, py + ph - 54, c.foot, { w: 140, h: 34, size: 15, fill: P.violet, color: P.paper }) : ''}
      ${brackets(w, h)}`;
  },

  /* 12. 30-day quest map */
  quest(w, h, c) {
    const nodes = c.nodes || [];
    const r2 = rng('quest');
    const y = (i) => h * 0.52 + Math.sin(i * 1.6) * h * 0.16;
    const x = (i) => w - 90 - (i * (w - 190)) / Math.max(1, nodes.length - 1);
    const path = nodes.map((_, i) => `${i ? 'L' : 'M'}${x(i)} ${y(i)}`).join('');
    return `${panel(w, h)}
      <path d="${path}" stroke="${P.slate}" stroke-width="6" fill="none" stroke-dasharray="2 14" stroke-linecap="round"/>
      ${nodes
        .map(
          (n, i) => `<g>
        <circle cx="${x(i)}" cy="${y(i)}" r="34" fill="${P.panelDeep}" stroke="${n.color || P.lime}" stroke-width="4"/>
        ${t(x(i), y(i) + 7, n.badge, { size: 18, fill: n.color || P.lime, weight: 900, rtl: false })}
        ${t(x(i), y(i) + 62, n.label, { size: 16, fill: P.paper })}</g>`
        )
        .join('')}
      ${t(w - 30, 48, c.title || '', { size: 22, anchor: 'end', fill: P.paper })}
      ${brackets(w, h)}`;
  },

  /* 13. armor / shield */
  shield(w, h, c) {
    const cx = w * 0.5, cy = h * 0.5, s = Math.min(w, h) * 0.32;
    return `${panel(w, h)}
      <path d="M${cx} ${cy - s * 1.25}l${s} ${s * 0.42}v${s * 0.62}c0 ${s * 0.72} -${s * 0.42} ${s * 1.16} -${s} ${s * 1.4}c-${s * 0.58} -${s * 0.24} -${s} -${s * 0.68} -${s} -${s * 1.4}v-${s * 0.62}z"
        fill="${P.panelDeep}" stroke="${P.teal}" stroke-width="6"/>
      <path d="M${cx} ${cy - s * 0.95}l${s * 0.66} ${s * 0.28}v${s * 0.42}c0 ${s * 0.5} -${s * 0.28} ${s * 0.8} -${s * 0.66} ${s * 0.96}c-${s * 0.38} -${s * 0.16} -${s * 0.66} -${s * 0.46} -${s * 0.66} -${s * 0.96}v-${s * 0.42}z"
        fill="${P.teal}" opacity="0.18"/>
      ${t(cx, cy + s * 0.12, c.big || '', { size: s * 0.52, fill: P.teal, weight: 900, rtl: false })}
      ${t(cx, cy + s * 0.55, c.label || '', { size: s * 0.2, fill: P.paper })}
      ${bar(w * 0.28, h * 0.88, w * 0.44, 18, c.pct ?? 0.72, { fill: P.teal })}
      ${brackets(w, h, P.teal)}`;
  },

  /* 14. group chat pressure */
  chat(w, h, c) {
    const msgs = c.messages || [];
    // mirror the advance used below so the column sits truly centred
    const est = msgs.reduce((n, m) => n + 30 + (String(m.text).split('|').length - 1) * 26 + 34, 0) - 16;
    let y = Math.max(40, (h - est) / 2);
    const out = msgs
      .map((m) => {
        const bw = w * (m.w || 0.46), bh = 30 + (String(m.text).split('|').length - 1) * 26;
        const x = m.me ? 40 : w - 40 - bw;
        const g = `<g><rect x="${x}" y="${y}" width="${bw}" height="${bh + 18}" rx="16" fill="${m.me ? P.violet : '#FFFFFF12'}"/>
        ${String(m.text)
          .split('|')
          .map((line, i) =>
            t(m.me ? x + 18 : x + bw - 18, y + 30 + i * 26, line, {
              size: 18, anchor: m.me ? 'start' : 'end', fill: P.paper, weight: 700,
            })
          )
          .join('')}</g>`;
        y += bh + 34;
        return g;
      })
      .join('');
    return `${panel(w, h)}${out}${brackets(w, h)}`;
  },

  /* 15. skill tree */
  skills(w, h, c) {
    const nodes = c.nodes || [];
    const cx = w - 110, cy = h / 2;
    return `${panel(w, h)}
      <circle cx="${cx}" cy="${cy}" r="52" fill="${P.violet}"/>
      ${t(cx, cy + 8, c.root || 'SKILL', { size: 18, fill: P.paper, weight: 900 })}
      ${nodes
        .map((n, i) => {
          const ny = 70 + i * ((h - 140) / Math.max(1, nodes.length - 1));
          const nx = 150;
          return `<g><path d="M${cx - 52} ${cy}C${cx - 160} ${cy} ${nx + 200} ${ny} ${nx + 92} ${ny}"
            stroke="${n.color || P.lime}" stroke-width="3" fill="none" opacity="0.7"/>
            <rect x="${nx - 60}" y="${ny - 22}" width="152" height="44" rx="14" fill="${P.panelDeep}" stroke="${n.color || P.lime}" stroke-width="3"/>
            ${t(nx + 16, ny + 7, n.label, { size: 17, fill: P.paper })}</g>`;
        })
        .join('')}
      ${brackets(w, h)}`;
  },

  /* 16. receipt / discount illusion */
  receipt(w, h, c) {
    const rw = w * 0.42, rx = w * 0.5 - rw / 2, ry = h * 0.12, rh = h * 0.74;
    const lines = c.lines || [];
    return `${panel(w, h)}
      <path d="M${rx} ${ry}h${rw}v${rh}l-${rw / 8} -18l-${rw / 8} 18l-${rw / 8} -18l-${rw / 8} 18l-${rw / 8} -18l-${rw / 8} 18l-${rw / 8} -18l-${rw / 8} 18z"
        fill="${P.paper}"/>
      ${t(rx + rw / 2, ry + 44, c.title || '', { size: 20, fill: P.ink, weight: 900 })}
      <path d="M${rx + 20} ${ry + 60}h${rw - 40}" stroke="${P.ink}" stroke-opacity="0.2" stroke-width="2" stroke-dasharray="5 5"/>
      ${lines
        .map((l, i) => {
          const y = ry + 96 + i * 40;
          return `${t(rx + rw - 22, y, l.k, { size: 17, anchor: 'end', fill: P.ink, weight: 700 })}
          ${t(rx + 22, y, l.v, { size: 17, anchor: 'start', fill: l.hot ? P.coral : P.ink, weight: 900, rtl: false })}`;
        })
        .join('')}
      ${c.stamp ? `<g transform="rotate(-12 ${w * 0.5} ${ry + rh * 0.82})">${chip(w * 0.5 - 88, ry + rh * 0.78, c.stamp, { w: 176, h: 42, size: 18, fill: P.coral, color: P.paper })}</g>` : ''}
      ${brackets(w, h)}`;
  },

  /* 17. card & phone tap */
  tap(w, h, c) {
    const cw = w * 0.34, ch2 = cw * 0.63;
    const cx = w * 0.6, cy = h * 0.42;
    return `${panel(w, h)}
      <rect x="${cx - cw / 2}" y="${cy - ch2 / 2}" width="${cw}" height="${ch2}" rx="16" fill="${P.violet}"/>
      <rect x="${cx - cw / 2}" y="${cy - ch2 * 0.12}" width="${cw}" height="${ch2 * 0.2}" fill="${P.ink}" opacity="0.35"/>
      <rect x="${cx + cw * 0.18}" y="${cy - ch2 * 0.38}" width="${cw * 0.2}" height="${cw * 0.14}" rx="4" fill="${P.gold}"/>
      ${t(cx - cw * 0.36, cy + ch2 * 0.38, c.cardLabel || '', { size: 15, anchor: 'start', fill: P.paper, opacity: 0.8 })}
      <g>${[0, 1, 2]
        .map(
          (i) =>
            `<path d="M${cx - cw * 0.66 - i * 18} ${cy - 26 - i * 10}a${26 + i * 16} ${26 + i * 16} 0 0 0 0 ${52 + i * 20}"
          stroke="${P.lime}" stroke-width="4" fill="none" opacity="${0.9 - i * 0.25}" stroke-linecap="round"/>`
        )
        .join('')}</g>
      ${t(w / 2, h * 0.82, c.caption || '', { size: 21, fill: P.paper })}
      ${chip(w * 0.5 - 82, h * 0.88, c.tag || '', { w: 164, h: 36, size: 15, fill: P.coral, color: P.paper })}
      ${brackets(w, h)}`;
  },

  /* 18. goal target */
  target(w, h, c) {
    const cx = w * 0.35, cy = h * 0.5, r = Math.min(w, h) * 0.3;
    return `${panel(w, h)}
      ${[1, 0.72, 0.44].map((k, i) => `<circle cx="${cx}" cy="${cy}" r="${r * k}" fill="none" stroke="${[P.violetSoft, P.lime, P.coral][i]}" stroke-width="${r * 0.16}"/>`).join('')}
      <circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="${P.gold}"/>
      <path d="M${cx + r * 0.9} ${cy - r * 0.9}L${cx + r * 0.16} ${cy - r * 0.16}" stroke="${P.paper}" stroke-width="6" stroke-linecap="round"/>
      <path d="M${cx + r * 0.86} ${cy - r * 1.02}l${r * 0.3} ${r * 0.1}l-${r * 0.1} -${r * 0.3}z" fill="${P.paper}"/>
      ${(c.rows || [])
        .map((row, i) => {
          const y = h * 0.28 + i * (h * 0.16);
          return `<g>${t(w - 40, y, row.k, { size: 19, anchor: 'end', fill: P.paper })}
          ${bar(w * 0.58, y + 10, w * 0.28, 16, row.pct, { fill: row.color || P.lime })}</g>`;
        })
        .join('')}
      ${brackets(w, h)}`;
  },

  /* 19. loot box */
  loot(w, h, c) {
    const cx = w / 2, cy = h * 0.56, s = Math.min(w, h) * 0.24;
    return `${panel(w, h)}
      <path d="M${cx - s} ${cy - s * 0.2}h${s * 2}v${s * 1.1}h-${s * 2}z" fill="${P.violet}"/>
      <path d="M${cx - s * 1.1} ${cy - s * 0.72}h${s * 2.2}v${s * 0.56}h-${s * 2.2}z" fill="${P.violetSoft}"/>
      <rect x="${cx - s * 0.16}" y="${cy - s * 0.72}" width="${s * 0.32}" height="${s * 1.62}" fill="${P.gold}"/>
      ${[[-1.1, -1.2], [0, -1.5], [1.1, -1.2]]
        .map(([dx, dy], i) => `<circle cx="${cx + dx * s}" cy="${cy + dy * s}" r="${s * (0.12 - i * 0.01)}" fill="${[P.lime, P.coral, P.teal][i]}"/>`)
        .join('')}
      ${t(cx, h * 0.18, c.title || '', { size: 23, fill: P.paper, weight: 900 })}
      ${t(cx, h * 0.9, c.caption || '', { size: 19, fill: P.coral })}
      ${brackets(w, h, P.coral)}`;
  },

  /* 20. trophy / completion */
  trophy(w, h, c) {
    const cx = w / 2, cy = h * 0.46, s = Math.min(w, h) * 0.22;
    return `${panel(w, h, P.panelDeep)}
      <circle cx="${cx}" cy="${cy}" r="${s * 1.7}" fill="${P.lime}" opacity="0.12"/>
      <path d="M${cx - s * 0.8} ${cy - s}h${s * 1.6}v${s * 0.7}a${s * 0.8} ${s * 0.8} 0 0 1 -${s * 1.6} 0z" fill="${P.gold}"/>
      <path d="M${cx - s * 0.8} ${cy - s * 0.86}h-${s * 0.5}a${s * 0.5} ${s * 0.5} 0 0 0 ${s * 0.5} ${s * 0.5}" fill="none" stroke="${P.gold}" stroke-width="${s * 0.16}"/>
      <path d="M${cx + s * 0.8} ${cy - s * 0.86}h${s * 0.5}a${s * 0.5} ${s * 0.5} 0 0 1 -${s * 0.5} ${s * 0.5}" fill="none" stroke="${P.gold}" stroke-width="${s * 0.16}"/>
      <rect x="${cx - s * 0.16}" y="${cy - s * 0.2}" width="${s * 0.32}" height="${s * 0.6}" fill="${P.gold}"/>
      <rect x="${cx - s * 0.6}" y="${cy + s * 0.4}" width="${s * 1.2}" height="${s * 0.22}" rx="6" fill="${P.gold}"/>
      ${t(cx, h * 0.8, c.title || '', { size: 26, fill: P.lime, weight: 900 })}
      ${t(cx, h * 0.88, c.caption || '', { size: 18, fill: P.paper, opacity: 0.8 })}
      ${brackets(w, h, P.gold)}`;
  },

  /* 21. table / ledger */
  ledger(w, h, c) {
    const rows = c.rows || [];
    const cols = c.cols || 3;
    const top = 86, bottom = h - 32;
    const rh = Math.min(62, (bottom - top) / Math.max(1, rows.length));
    const start = top + (bottom - top - rh * rows.length) / 2;
    return `${panel(w, h)}
      ${t(w - 32, 52, c.title || '', { size: 23, anchor: 'end', fill: P.paper })}
      ${rows
        .map((r, i) => {
          const y = start + i * rh;
          const cw = (w - 64) / cols;
          return `<g><rect x="32" y="${y}" width="${w - 64}" height="${rh - 6}" rx="10" fill="${i === 0 ? P.violet : '#FFFFFF0A'}"/>
          ${r
            .slice(0, cols)
            .map((cell, j) =>
              t(w - 32 - j * cw - 16, y + rh * 0.62, cell, {
                size: 17, anchor: 'end', fill: i === 0 ? P.paper : P.paper, opacity: i === 0 ? 1 : 0.85, weight: i === 0 ? 900 : 700,
              })
            )
            .join('')}</g>`;
        })
        .join('')}
      ${brackets(w, h)}`;
  },

  /* 22. numbered rule stack */
  rules(w, h, c) {
    const items = c.items || [];
    const top = 92, bottom = h - 30;
    const rh = Math.min(66, (bottom - top) / Math.max(1, items.length));
    const start = top + (bottom - top - rh * items.length) / 2;
    return `${panel(w, h)}
      ${t(w - 34, 56, c.title || '', { size: 24, anchor: 'end', fill: P.lime, weight: 900 })}
      ${items
        .map((it, i) => {
          const y = start + i * rh;
          return `<g>
          <rect x="34" y="${y}" width="${w - 68}" height="${rh - 10}" rx="12" fill="#FFFFFF0A"/>
          <circle cx="${w - 66}" cy="${y + (rh - 10) / 2}" r="16" fill="${P.violet}"/>
          ${t(w - 66, y + (rh - 10) / 2 + 6, String(i + 1), { size: 16, fill: P.paper, weight: 900, rtl: false })}
          ${t(w - 96, y + (rh - 10) / 2 + 6, it, { size: 17, anchor: 'end', fill: P.paper, opacity: 0.9 })}</g>`;
        })
        .join('')}
      ${brackets(w, h)}`;
  },
};

const SCENE_PROPS = {
  phoneBroken(w, h) {
    const x = w * 0.36, y = h * 0.5;
    return `<g><rect x="${x}" y="${y}" width="52" height="88" rx="10" fill="${P.paper}" stroke="${P.ink}" stroke-width="3"/>
      <path d="M${x + 8} ${y + 20}l18 16l-12 10l20 22" stroke="${P.coral}" stroke-width="4" fill="none"/></g>`;
  },
  sneaker(w, h) {
    const x = w * 0.34, y = h * 0.62;
    return `<g><path d="M${x} ${y}h56l26 22h22a12 12 0 0 1 0 24h-104z" fill="${P.coral}"/>
      <path d="M${x + 10} ${y + 10}h40" stroke="${P.paper}" stroke-width="4"/></g>`;
  },
  suitcase(w, h) {
    const x = w * 0.34, y = h * 0.56;
    return `<g><rect x="${x}" y="${y}" width="86" height="64" rx="10" fill="${P.gold}"/>
      <rect x="${x + 30}" y="${y - 16}" width="26" height="18" rx="6" fill="none" stroke="${P.gold}" stroke-width="5"/>
      <rect x="${x + 12}" y="${y + 14}" width="62" height="8" rx="4" fill="${P.ink}" opacity="0.3"/></g>`;
  },
  laptop(w, h) {
    const x = w * 0.32, y = h * 0.56;
    return `<g><path d="M${x} ${y}h96v58h-96z" fill="${P.panelDeep}" stroke="${P.teal}" stroke-width="3"/>
      <path d="M${x - 12} ${y + 58}h120l10 12h-140z" fill="${P.teal}"/>
      <path d="M${x + 16} ${y + 40}l20 -22l16 14l22 -26" stroke="${P.lime}" stroke-width="4" fill="none"/></g>`;
  },
  cart(w, h) {
    const x = w * 0.34, y = h * 0.58;
    return `<g><path d="M${x} ${y}h14l16 46h56l14 -34h-72" stroke="${P.lime}" stroke-width="5" fill="none" stroke-linejoin="round"/>
      <circle cx="${x + 36}" cy="${y + 58}" r="8" fill="${P.lime}"/><circle cx="${x + 78}" cy="${y + 58}" r="8" fill="${P.lime}"/></g>`;
  },
};

/* ── public API ──────────────────────────────────────────────────────── */

export const ARCHETYPES = Object.keys(SCENES);

export function renderArt(archetype, config = {}, size = {}) {
  const w = size.w || 900;
  const h = size.h || 520;
  const scene = SCENES[archetype] || SCENES.scene;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(config.alt || '')}"
    xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <title>${esc(config.alt || '')}</title>${scene(w, h, config)}</svg>`;
}
