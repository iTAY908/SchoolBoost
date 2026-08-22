/**
 * AGENT 2 — EDITOR & LAYOUT
 *
 * Takes the sealed source text and the Visual agent's 50 storyboarded pages and
 * assembles the finished book: typography, page furniture, chapter openers,
 * callouts, worksheets, progress HUD, print styles.
 *
 * It renders the source text VERBATIM. Everything the Teen Reviewer asks for is
 * applied through `layout` — a presentation-only parameter set.
 */
import { PALETTE as P } from '../lib/art.mjs';

export const baseLayout = {
  scale: 1.0,            // type scale multiplier
  measure: 62,           // max line length in characters
  density: 'comfortable',// comfortable | airy
  hooks: false,          // per-page hook line above the text
  pageBadges: false,     // chapter progress badge in the page header
  pullQuotes: false,     // promote one quote per chapter to a display pull-quote
  chapterHud: false,     // stats strip on chapter openers
  tocCards: false,       // visual table of contents instead of a plain list
  runningFooter: false,  // page numbers + chapter name in the footer
  accentRotation: false, // per-chapter accent colour
  microCopy: false,      // reading-time + "what you get" chips
  endMarkers: false,     // end-of-chapter marker with a next-up teaser
  paragraphBeats: false, // breathing mark that breaks long runs of plain text
};

const ACCENTS = [P.lime, P.violet, P.coral, P.teal, P.gold, P.violetSoft];

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/* Inline typography: quotes, numbers and shekel amounts get light emphasis.
   This wraps characters, it never changes them. */
function inline(text) {
  return esc(text).replace(/(\d[\d,\.]*\s?₪|\d+%)/g, '<b class="num">$1</b>');
}

const HOOKS = {
  'ch-01': 'קיבלת כסף. עכשיו מתחילה ההחלטה.',
  'ch-02': 'ארבע קופות, מספר אחד, ואפס בלגן.',
  'ch-03': 'הכסף שנועד ליום שבו משהו נשבר.',
  'ch-04': 'איך נשארים עם כסף גם ביום האחרון.',
  'ch-05': 'המוח שלך רוצה לקנות. הנה איך עוצרים אותו.',
  'ch-06': 'הזמן הוא המשאב שאי אפשר לקנות.',
  'ch-07': 'הכישרון שלך שווה כסף. בוא נבדוק כמה.',
  'ch-08': 'לחיצה אחת לא מרגישה כמו שטר. זו הבעיה.',
  'ch-09': 'לומר "לא" בלי לאבד חברים.',
  'ch-10': 'ארבע טעויות שאפשר ללמוד בלי לשלם עליהן.',
  'ch-11': 'כאן הכול מתחבר לתוכנית אחת.',
  'ch-12': 'המשחק לא נגמר. פשוט למדת לשחק.',
  'ch-13': 'דף אחד. צילום מסך. סיימנו.',
};

const NEXT_UP = {
  'ch-01': 'ואיך מחלקים את זה בפועל? עמוד הבא.',
  'ch-02': 'ומה קורה כשמשהו נשבר? פרק 2.',
  'ch-03': 'עכשיו נתכנן חופשה שלא תרוקן אותך.',
  'ch-04': 'ומי בעצם מחליט שאתה רוצה את זה?',
  'ch-05': 'ומה קורה לכסף שפשוט נשאר במקום?',
  'ch-06': 'ואם במקום לחסוך — גם נרוויח יותר?',
  'ch-07': 'שים לב איפה הכסף הדיגיטלי נעלם.',
  'ch-08': 'והחלק הקשה באמת: החברים.',
  'ch-09': 'ארבע טעויות קלאסיות — ואיך לדלג עליהן.',
  'ch-10': 'זמן להרכיב את התוכנית שלך.',
  'ch-11': 'סיכום: מה באמת למדת כאן.',
  'ch-12': 'דף אחד לשמור בטלפון.',
  'ch-13': '',
};

const CHAPTER_TAGS = {
  'ch-01': 'INTRO', 'ch-02': 'LEVEL 1', 'ch-03': 'LEVEL 2', 'ch-04': 'LEVEL 3',
  'ch-05': 'LEVEL 4', 'ch-06': 'LEVEL 5', 'ch-07': 'LEVEL 6', 'ch-08': 'LEVEL 7',
  'ch-09': 'LEVEL 8', 'ch-10': 'LEVEL 9', 'ch-11': 'LEVEL 10', 'ch-12': 'BOSS CLEARED',
  'ch-13': 'CHEAT SHEET',
};

/* ── block rendering (verbatim text, styled containers) ──────────────── */

function renderBlock(block, ctx) {
  switch (block.type) {
    case 'p':
      return `<p>${inline(block.text)}</p>`;

    case 'quote':
      if (ctx.layout.pullQuotes && !ctx.pullUsed && block.text.length < 80) {
        ctx.pullUsed = true;
        return `<blockquote class="pull"><span>${inline(block.text)}</span></blockquote>`;
      }
      return `<blockquote>${inline(block.text)}</blockquote>`;

    case 'note':
      return `<aside class="callout note"><span class="callout-tag">שים לב</span><p>${inline(block.text)}</p></aside>`;

    case 'rule':
      return `<aside class="callout rule"><span class="callout-tag">כלל</span><p>${inline(block.text)}</p></aside>`;

    case 'list':
      return `<ul>${block.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;

    case 'olist':
      return `<ol>${block.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`;

    case 'checklist':
      return `<ul class="checklist">${block.items
        .map(
          (i, n) =>
            `<li><span class="box" aria-hidden="true"></span><span class="check-text">${inline(i)}</span></li>`
        )
        .join('')}</ul>`;

    case 'table': {
      const head = `<tr>${block.head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr>`;
      const rows = block.rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('');
      return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
    }

    case 'group': {
      const variant = { wallet: 'wallet', boss: 'boss', day: 'day' }[block.variant] || 'wallet';
      const body = block.blocks.map((b) => renderBlock(b, ctx)).join('');
      return `<section class="card card-${variant}">
        <h4 class="card-label">${inline(block.label)}</h4>
        <div class="card-body">${body}</div>
      </section>`;
    }

    default:
      return '';
  }
}

/* ── page rendering ──────────────────────────────────────────────────── */

function renderPage(page, ctx, index, total) {
  const { layout } = ctx;
  const accent = layout.accentRotation ? ACCENTS[page.chapter.index % ACCENTS.length] : P.violet;
  const chapterPages = ctx.pagesByChapter.get(page.chapter.id);
  const posInChapter = chapterPages.indexOf(page) + 1;

  if (page.kind === 'cover') {
    return `<section class="page page-cover" id="page-1" style="--accent:${P.lime}">
      <figure class="art art-cover">${page.svg}</figure>
      <div class="cover-copy">
        <p class="cover-kicker">${esc(CHAPTER_TAGS['ch-01'])} · ספר דיגיטלי אינטראקטיבי</p>
        <h1>${esc(ctx.doc.title)}</h1>
        <p class="cover-sub">${esc(ctx.doc.subtitle)}</p>
        <p class="cover-caption">${esc(page.caption)}</p>
        ${layout.microCopy ? `<ul class="cover-chips">
          <li>${total} עמודים</li><li>${total} איורים</li><li>10 פרקים</li>
          <li>${ctx.readMinutes} דק׳ קריאה</li><li>9 סיפורי מקרה</li><li>4 צ׳ק-ליסטים</li>
        </ul>` : ''}
      </div>
    </section>`;
  }

  const opener = page.isChapterOpener;
  const header = opener
    ? `<header class="chapter-open">
        <span class="level-tag">${esc(CHAPTER_TAGS[page.chapter.id] || '')}</span>
        <h2>${esc(page.chapter.title)}</h2>
        ${layout.hooks && HOOKS[page.chapter.id] ? `<p class="hook">${esc(HOOKS[page.chapter.id])}</p>` : ''}
        ${layout.chapterHud ? `<div class="chapter-hud">
            <span><b>${chapterPages.length}</b> עמודים</span>
            <span><b>${ctx.chapterStats.get(page.chapter.id).minutes}</b> דק׳</span>
            <span><b>${ctx.chapterStats.get(page.chapter.id).visuals}</b> איורים</span>
          </div>` : ''}
      </header>`
    : `<header class="page-head">
        <span class="page-chapter">${esc(page.chapter.title)}</span>
        ${layout.pageBadges ? `<span class="page-badge">${posInChapter}/${chapterPages.length}</span>` : ''}
      </header>`;

  const sectionTitles = new Set();
  let run = 0; // consecutive plain-text blocks, for the breathing mark
  const body = page.units
    .map((unit) => {
      const parts = [];
      if (unit.section.title && unit.part === 0 && !sectionTitles.has(unit.section.id)) {
        sectionTitles.add(unit.section.id);
        parts.push(`<h3>${esc(unit.section.title)}</h3>`);
        run = 0;
      } else if (unit.part > 0) {
        parts.push(`<p class="cont">המשך · ${esc(unit.section.title || page.chapter.title)}</p>`);
        run = 0;
      }
      for (const b of unit.blocks) {
        const plain = b.type === 'p' || b.type === 'quote';
        // A beat only earns its place before a real paragraph — the short
        // staccato lines in this manuscript already carry their own rhythm.
        const long = plain && (b.text || '').length >= 45;
        if (layout.paragraphBeats && long && run >= 4) {
          parts.push('<div class="beat" aria-hidden="true"><span></span><span></span><span></span></div>');
          run = 0;
        }
        parts.push(renderBlock(b, ctx));
        run = plain ? run + 1 : 0;
      }
      return parts.join('');
    })
    .join('');

  const isLastOfChapter = chapterPages[chapterPages.length - 1] === page;
  const endMarker =
    layout.endMarkers && isLastOfChapter && NEXT_UP[page.chapter.id]
      ? `<div class="end-marker"><span class="end-dot"></span>
         <p>${esc(NEXT_UP[page.chapter.id])}</p></div>`
      : '';

  return `<section class="page${opener ? ' page-opener' : ''}" id="page-${page.number}" style="--accent:${accent}">
    ${header}
    <figure class="art">
      ${page.svg}
      <figcaption>${esc(page.caption)}</figcaption>
    </figure>
    <div class="prose">${body}${endMarker}</div>
    ${layout.runningFooter
      ? `<footer class="page-foot"><span>${esc(ctx.doc.title)}</span><span class="folio">${page.number} / ${total}</span></footer>`
      : `<footer class="page-foot"><span class="folio">${page.number}</span></footer>`}
  </section>`;
}

/* ── styles ──────────────────────────────────────────────────────────── */

function styles(layout) {
  const s = layout.scale;
  const gap = layout.density === 'airy' ? 1.28 : 1.0;
  return `
  :root{
    --ink:${P.ink}; --paper:${P.paper}; --panel:${P.panel}; --panel-deep:${P.panelDeep};
    --violet:${P.violet}; --violet-soft:${P.violetSoft}; --lime:${P.lime};
    --coral:${P.coral}; --teal:${P.teal}; --gold:${P.gold}; --slate:${P.slate};
    --accent:${P.violet};
    --fs:${(17 * s).toFixed(2)}px;
    --gap:${(1.05 * gap).toFixed(2)}rem;
    --measure:${layout.measure}ch;
  }
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:var(--ink);color:var(--ink);
    font-family:'Heebo','Assistant','Arial Hebrew',system-ui,sans-serif;
    direction:rtl;text-align:right;-webkit-font-smoothing:antialiased}
  h1,h2,h3,.card-label,.toc h2,.level-tag,blockquote.pull span{
    font-family:'Secular One','Heebo','Arial Hebrew',sans-serif;font-weight:400;
    text-wrap:balance}
  .book{max-width:840px;margin:0 auto;padding:clamp(10px,2vw,26px) clamp(8px,2vw,20px) 60px}

  .page{background:var(--paper);border-radius:20px;scroll-margin-top:64px;padding:clamp(18px,3.4vw,34px);
    margin-bottom:clamp(14px,2.4vw,22px);position:relative;overflow:hidden;
    box-shadow:0 1px 0 rgba(255,255,255,.06)}
  .page-opener::before{content:"";position:absolute;inset-inline:0;top:0;height:8px;background:var(--accent)}
  .page-opener{padding-top:clamp(26px,4vw,42px)}

  .page-cover{background:${P.panelDeep};color:var(--paper);padding:0;text-align:center}
  .art-cover svg{display:block;width:100%}
  .cover-copy{padding:clamp(20px,4vw,38px)}
  .cover-kicker{margin:0 0 10px;font-size:.78rem;letter-spacing:.14em;color:var(--lime);font-weight:800}
  .page-cover h1{margin:0;font-size:clamp(2rem,6.2vw,3rem);line-height:1.1;letter-spacing:-.01em;color:var(--paper)}
  .cover-sub{margin:.5rem 0 0;color:var(--violet-soft);font-weight:700;font-size:1.02rem}
  .cover-caption{margin:1.1rem auto 0;max-width:34ch;color:#C9CEDE;font-size:.98rem;line-height:1.6}
  .cover-chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:1.4rem 0 0;padding:0}
  .cover-chips li{font-size:.8rem;font-weight:800;color:var(--paper);
    border:1.5px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 13px}

  .chapter-open{margin:0 0 1.1rem}
  .level-tag{display:inline-block;background:var(--accent);color:${P.paper};
    font-size:.76rem;letter-spacing:.12em;padding:5px 13px;border-radius:999px}
  .page-opener h2{margin:.7rem 0 0;font-size:clamp(1.45rem,4.4vw,2.05rem);line-height:1.18}
  .hook{margin:.55rem 0 0;font-size:1.02rem;font-weight:700;color:var(--accent)}
  .chapter-hud{display:flex;gap:16px;margin-top:.9rem;padding-top:.8rem;border-top:2px dashed rgba(20,22,31,.14);
    font-size:.82rem;color:${P.slate};font-weight:700}
  .chapter-hud b{color:var(--ink);font-size:1.05rem}

  .page-head{display:flex;align-items:center;justify-content:space-between;gap:10px;
    margin-bottom:.9rem;padding-bottom:.55rem;border-bottom:2px solid var(--accent)}
  .page-chapter{font-size:.78rem;font-weight:800;color:${P.slate};letter-spacing:.02em}
  .page-badge{font-size:.72rem;font-weight:900;color:var(--paper);background:var(--accent);
    border-radius:999px;padding:3px 10px}

  .art{margin:0 0 1.15rem;border-radius:16px;overflow:hidden;background:${P.panel}}
  .art svg{display:block;width:100%;height:auto}
  .art figcaption{padding:12px 16px;background:${P.panelDeep};color:#D8DDEC;
    font-size:.9rem;font-weight:700;line-height:1.5;border-top:2px solid var(--accent)}

  .prose{max-width:var(--measure)}
  .prose p{margin:0 0 var(--gap);font-size:var(--fs);line-height:1.75}
  .cont{font-size:.75rem!important;font-weight:800;color:${P.slate};letter-spacing:.04em;
    margin-bottom:.7rem!important}
  h3{margin:1.5rem 0 .7rem;font-size:clamp(1.14rem,3vw,1.34rem);line-height:1.28}
  h3::after{content:"";display:block;width:42px;height:4px;border-radius:2px;background:var(--accent);margin-top:.5rem}
  .prose > h3:first-child{margin-top:0}

  ul,ol{margin:0 0 var(--gap);padding-inline-start:0;padding-inline-end:1.15rem}
  li{font-size:var(--fs);line-height:1.7;margin-bottom:.32rem}
  ul li::marker{color:var(--accent)}
  ol li::marker{color:var(--accent);font-weight:900}

  blockquote{margin:0 0 var(--gap);padding:.7rem 1rem;border-inline-start:4px solid var(--accent);
    background:rgba(106,75,255,.06);border-radius:0 12px 12px 0;
    font-size:calc(var(--fs) * 1.02);font-weight:700;line-height:1.6}
  blockquote.pull{border:0;background:none;padding:1.1rem 0;text-align:center}
  blockquote.pull span{font-size:calc(var(--fs) * 1.55);line-height:1.28;
    background:linear-gradient(transparent 62%, color-mix(in srgb, var(--accent) 34%, transparent) 0);
    box-decoration-break:clone;-webkit-box-decoration-break:clone}

  .callout{margin:0 0 var(--gap);padding:.9rem 1.05rem;border-radius:14px;position:relative}
  .callout p{margin:0;font-size:var(--fs);line-height:1.65;font-weight:700}
  .callout-tag{display:inline-block;font-size:.68rem;font-weight:900;letter-spacing:.1em;
    padding:3px 9px;border-radius:999px;margin-bottom:.5rem}
  .callout.note{background:rgba(255,176,32,.13);border:2px solid rgba(255,176,32,.5)}
  .callout.note .callout-tag{background:${P.gold};color:${P.ink}}
  .callout.rule{background:${P.panelDeep};color:var(--paper)}
  .callout.rule .callout-tag{background:${P.lime};color:${P.ink}}

  .checklist{list-style:none;padding:0;margin:0 0 var(--gap)}
  .checklist li{display:flex;gap:10px;align-items:flex-start;padding:.5rem .7rem;margin-bottom:.4rem;
    background:rgba(20,22,31,.04);border-radius:10px}
  .box{flex:0 0 auto;width:19px;height:19px;margin-top:3px;border-radius:5px;
    border:2.5px solid var(--accent);background:#fff}
  .check-text{font-size:var(--fs);line-height:1.55}

  .table-wrap{overflow-x:auto;margin:0 0 var(--gap);border-radius:14px;border:2px solid rgba(20,22,31,.1)}
  table{width:100%;border-collapse:collapse;min-width:320px}
  th{background:${P.panelDeep};color:var(--paper);font-size:.86rem;font-weight:900;padding:11px 13px;text-align:right}
  td{padding:11px 13px;font-size:.94rem;border-top:1px solid rgba(20,22,31,.08);
    font-variant-numeric:tabular-nums}
  tbody tr:nth-child(even){background:rgba(20,22,31,.03)}
  tbody tr:last-child td{font-weight:900}

  .card{margin:0 0 var(--gap);padding:1rem 1.1rem;border-radius:16px;background:rgba(20,22,31,.035);
    border:2px solid rgba(20,22,31,.09)}
  .card-label{margin:0 0 .6rem;font-size:1.08rem}
  .card-body > :last-child{margin-bottom:0}
  .card-wallet{border-inline-start:6px solid var(--teal)}
  .card-boss{border-inline-start:6px solid var(--coral)}
  .card-day{border-inline-start:6px solid var(--gold)}

  .num{font-weight:900;color:var(--accent);font-feature-settings:"tnum"}
  .callout.rule .num{color:${P.lime}}

  .beat{display:flex;gap:7px;justify-content:center;align-items:center;
    margin:calc(var(--gap) * .35) 0 var(--gap)}
  .beat span{width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:.5}
  .beat span:nth-child(2){opacity:.85;width:8px;height:8px}

  .end-marker{display:flex;align-items:center;gap:10px;margin-top:1.2rem;padding-top:.9rem;
    border-top:2px dashed rgba(20,22,31,.14)}
  .end-marker p{margin:0;font-size:.9rem;font-weight:800;color:${P.slate}}
  .end-dot{width:10px;height:10px;border-radius:50%;background:var(--accent);flex:0 0 auto}

  .page-foot{display:flex;justify-content:space-between;align-items:center;margin-top:1.3rem;
    padding-top:.7rem;border-top:1px solid rgba(20,22,31,.09);
    font-size:.72rem;font-weight:800;color:${P.slate}}
  .folio{margin-inline-start:auto;background:rgba(20,22,31,.06);border-radius:999px;padding:3px 10px;
    font-variant-numeric:tabular-nums}

  .toc{scroll-margin-top:64px;background:${P.panelDeep};color:var(--paper);border-radius:20px;padding:clamp(18px,3.4vw,32px);
    margin-bottom:clamp(14px,2.4vw,22px)}
  .toc h2{margin:0 0 1rem;font-size:1.4rem;color:var(--lime)}
  .toc ol{list-style:none;margin:0;padding:0;display:grid;gap:8px}
  .toc-cards ol{grid-template-columns:repeat(auto-fill,minmax(216px,1fr))}
  .toc a{display:grid;gap:7px;text-decoration:none;color:var(--paper);
    background:rgba(255,255,255,.05);border-radius:12px;padding:12px 14px;
    border:1.5px solid rgba(255,255,255,.09);transition:background .15s,border-color .15s}
  .toc a:hover{background:rgba(255,255,255,.11);border-color:var(--lime)}
  .toc-meta{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .toc .n{font-size:.7rem;font-weight:800;letter-spacing:.09em;color:var(--lime)}
  .toc .t{font-size:.95rem;line-height:1.35;font-family:'Secular One','Heebo',sans-serif;
    text-wrap:balance}
  .toc .p{font-size:.72rem;color:#9AA3BC;font-variant-numeric:tabular-nums}

  .hud{position:sticky;top:0;z-index:9;background:rgba(14,20,36,.92);backdrop-filter:blur(8px);
    border-bottom:1px solid rgba(255,255,255,.09);padding:9px clamp(10px,2vw,20px);
    display:flex;align-items:center;gap:12px}
  .hud-title{font-size:.8rem;font-weight:900;color:var(--paper);white-space:nowrap;
    overflow:hidden;text-overflow:ellipsis}
  .hud-bar{flex:1;height:8px;border-radius:999px;background:rgba(255,255,255,.13);overflow:hidden}
  .hud-fill{height:100%;width:0;background:linear-gradient(90deg,var(--violet),var(--lime));
    border-radius:999px;transition:width .12s linear}
  .hud-pct{font-size:.76rem;font-weight:900;color:var(--lime);min-width:4ch;text-align:left}

  a:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--lime);outline-offset:3px;border-radius:8px}

  @media (prefers-reduced-motion:reduce){
    *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  }
  @media (max-width:560px){
    .page{border-radius:16px}
    .toc-cards ol{grid-template-columns:1fr}
  }
  @media print{
    body{background:#fff}
    .hud{display:none}
    .book{max-width:none;padding:0}
    .page{break-after:page;box-shadow:none;border-radius:0;margin:0}
    .art{break-inside:avoid}
  }
  `;
}

/* ── the agent ───────────────────────────────────────────────────────── */

export function runEditor(doc, visual, layout = baseLayout) {
  const pages = visual.pages;
  const total = pages.length;

  const pagesByChapter = new Map();
  for (const p of pages) {
    if (p.kind === 'cover') continue;
    if (!pagesByChapter.has(p.chapter.id)) pagesByChapter.set(p.chapter.id, []);
    pagesByChapter.get(p.chapter.id).push(p);
  }

  const words = (p) =>
    p.units.flatMap((u) => u.blocks).reduce((n, b) => n + JSON.stringify(b).split(/\s+/).length, 0);
  const chapterStats = new Map();
  for (const [id, list] of pagesByChapter) {
    const w = list.reduce((n, p) => n + words(p), 0);
    chapterStats.set(id, { minutes: Math.max(1, Math.round(w / 190)), visuals: list.length });
  }
  const readMinutes = [...chapterStats.values()].reduce((n, c) => n + c.minutes, 0);

  const ctx = { doc, layout, pagesByChapter, chapterStats, readMinutes, pullUsed: false };

  const toc = `<nav class="toc${layout.tocCards ? ' toc-cards' : ''}" aria-label="תוכן העניינים">
    <h2>תוכן העניינים</h2>
    <ol>${doc.chapters
      .map((c) => {
        const first = (pagesByChapter.get(c.id) || [])[0];
        return `<li><a href="#page-${first ? first.number : 1}">
          <span class="toc-meta">
            <span class="n">${esc(CHAPTER_TAGS[c.id] || '')}</span>
            <span class="p">עמ׳ ${first ? first.number : 1}</span>
          </span>
          <span class="t">${esc(c.title)}</span></a></li>`;
      })
      .join('')}</ol>
  </nav>`;

  const head = `<title>5,000 ₪ — המשחק הפיננסי שלך</title>
<meta name="description" content="${esc(doc.subtitle)} — ספר דיגיטלי מאויר ב-${total} עמודים לבני ובנות נוער.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&family=Secular+One&display=swap" rel="stylesheet">
<style>${styles(layout)}</style>`;

  const body = `<div class="hud" role="progressbar" aria-label="התקדמות קריאה">
  <span class="hud-title">${esc(doc.title)}</span>
  <span class="hud-bar"><span class="hud-fill" id="hudFill"></span></span>
  <span class="hud-pct" id="hudPct">0%</span>
</div>
<main class="book">
${pages[0] ? renderPage(pages[0], ctx, 0, total) : ''}
${toc}
${pages.slice(1).map((p, i) => { if (p.isChapterOpener) ctx.pullUsed = false; return renderPage(p, ctx, i + 1, total); }).join('\n')}
</main>
<script>
(function(){
  var fill=document.getElementById('hudFill'),pct=document.getElementById('hudPct');
  function up(){
    var h=document.documentElement,max=h.scrollHeight-h.clientHeight;
    var v=max>0?Math.min(100,Math.round(h.scrollTop/max*100)):0;
    fill.style.width=v+'%';pct.textContent=v+'%';
  }
  addEventListener('scroll',up,{passive:true});addEventListener('resize',up);up();
})();
</script>`;

  // Two shapes of the same book:
  //  - `html`      : head + body, for hosts that supply their own document shell
  //  - `standalone`: a complete .html file you can open, mail or print
  const html = `${head}\n${body}`;
  const standalone = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
</head>
<body>
${body}
</body>
</html>`;

  return {
    html,
    standalone,
    stats: { pages: total, readMinutes, chapters: doc.chapters.length },
  };
}
