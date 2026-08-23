/**
 * AGENT 3 — TEEN REVIEWER (13-18)
 *
 * Reads the built book the way a 15-year-old would flip through it and answers
 * three questions:
 *   1. מעניין?      is it interesting
 *   2. נראה טוב?    does it look good
 *   3. שווה 20 ₪?   does it feel worth the money
 *
 * IRON RULE: it never deletes or rewrites the core script or the financial
 * content. Every finding it raises comes out as a directive of kind
 * style | layout | framing | visual — enforced in lib/integrity.mjs.
 */
import { assertDirectives } from '../lib/integrity.mjs';

const APPROVAL_PHRASE = '100% מוכן לקריאה';
export const PASS_SCORE = 88;
export const MIN_DIMENSION = 80;

/* ── measurements taken off the built HTML + the page model ──────────── */

function measure(html, visual, editorStats) {
  const pages = visual.pages;
  const text = html.replace(/<[^>]*>/g, ' ');

  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) =>
    m[1].replace(/<[^>]*>/g, '').trim()
  );
  const longParas = paragraphs.filter((p) => p.length > 260).length;

  // Longest run of plain text with no visual break, measured on the BUILT page
  // (so a layout fix by the editor actually shows up in the next score).
  let worstRun = 0, run = 0;
  for (const tag of html.match(/<(?:p|ul|ol|blockquote|aside|table|h2|h3|figure|div|section|header|footer)\b[^>]*>/g) || []) {
    if (/^<(?:p|blockquote)\b/.test(tag) && !/class="(?:cont|cover-|hook)/.test(tag)) run += 1;
    else { worstRun = Math.max(worstRun, run); run = 0; }
  }
  worstRun = Math.max(worstRun, run);

  const archetypes = new Set(pages.map((p) => p.meta && p.meta.archetype).filter(Boolean));
  const humanPages = pages.filter((p) => p.meta && p.meta.archetype === 'scene').length;

  return {
    pageCount: pages.length,
    captions: pages.filter((p) => p.caption && p.caption.length > 12).length,
    illustrations: (html.match(/<svg /g) || []).length,
    archetypeVariety: archetypes.size,
    humanRatio: humanPages / pages.length,
    longParas,
    worstRun,
    interactives: (html.match(/class="checklist"/g) || []).length +
      (html.match(/class="table-wrap"/g) || []).length,
    callouts: (html.match(/class="callout/g) || []).length,
    hooks: (html.match(/class="hook"/g) || []).length,
    pullQuotes: (html.match(/blockquote class="pull"/g) || []).length,
    badges: (html.match(/class="page-badge"/g) || []).length,
    tocCards: /toc toc-cards/.test(html),
    chapterHud: (html.match(/class="chapter-hud"/g) || []).length,
    endMarkers: (html.match(/class="end-marker"/g) || []).length,
    runningFooter: (html.match(/class="folio"/g) || []).length,
    microCopy: /cover-chips/.test(html),
    words: text.split(/\s+/).filter(Boolean).length,
    readMinutes: editorStats.readMinutes,
  };
}

/* ── the three questions, scored ─────────────────────────────────────── */

function scoreInteresting(m, layout) {
  let s = 100;
  const notes = [];
  if (!layout.hooks) { s -= 14; notes.push('פרק נפתח ישר בטקסט — אין שורת פתיחה שמושכת.'); }
  if (m.worstRun > 6) { s -= 12; notes.push(`יש רצף של ${m.worstRun} פסקאות בלי שום הפסקה ויזואלית. זה המקום שבו אני גולל/ת.`); }
  else if (m.worstRun > 4) { s -= 5; notes.push('יש קטעים עם קצת יותר מדי טקסט רצוף.'); }
  if (!layout.pullQuotes) { s -= 9; notes.push('המשפטים הכי חזקים בספר נראים בדיוק כמו כל השאר.'); }
  if (!layout.endMarkers) { s -= 8; notes.push('פרק נגמר ופשוט... נגמר. אין סיבה להמשיך לעמוד הבא.'); }
  if (m.humanRatio < 0.14) { s -= 6; notes.push('כמעט אין דמויות באיורים — זה מרגיש כמו מצגת, לא כמו סיפור.'); }
  return { score: Math.max(0, s), notes };
}

function scoreLooks(m, layout) {
  let s = 100;
  const notes = [];
  if (!layout.accentRotation) { s -= 11; notes.push('כל הפרקים באותו צבע — אחרי פרק שלישי הכול נראה אותו דבר.'); }
  if (layout.measure > 66) { s -= 8; notes.push('השורות ארוכות מדי, העין מאבדת את השורה.'); }
  if (layout.scale < 1.04) { s -= 8; notes.push('הפונט קטן לקריאה בטלפון.'); }
  if (layout.density !== 'airy') { s -= 7; notes.push('הכול דחוס. צריך אוויר בין הבלוקים.'); }
  if (!layout.tocCards) { s -= 6; notes.push('תוכן העניינים נראה כמו רשימת מטלות.'); }
  if (m.archetypeVariety < 10) { s -= 7; notes.push('האיורים חוזרים על עצמם מדי.'); }
  if (!layout.pageBadges) { s -= 5; notes.push('אני לא יודע/ת איפה אני בתוך הפרק.'); }
  return { score: Math.max(0, s), notes };
}

function scoreValue(m, layout) {
  let s = 100;
  const notes = [];
  if (m.illustrations < 50) { s -= 20; notes.push(`יש ${m.illustrations} איורים במקום 50 — זה לא מרגיש מוצר שלם.`); }
  if (m.captions < m.pageCount) { s -= 10; notes.push('יש עמודים בלי כתובית לאיור.'); }
  if (!layout.microCopy) { s -= 12; notes.push('בעמוד הראשון אני לא רואה מה אני מקבל/ת תמורת 20 ₪.'); }
  if (!layout.chapterHud) { s -= 8; notes.push('אין לי מושג כמה זמן פרק לוקח לפני שאני מתחיל/ה.'); }
  if (!layout.runningFooter) { s -= 6; notes.push('אין מספרי עמודים אמיתיים — לא מרגיש כמו ספר.'); }
  if (m.interactives < 6) { s -= 6; notes.push('מעט מדי דברים למלא ולסמן.'); }
  return { score: Math.max(0, s), notes };
}

/* ── directives (presentation only) ──────────────────────────────────── */

const FIXES = [
  { id: 'hooks', kind: 'framing', when: (m, l) => !l.hooks,
    ask: 'תוסיפו שורת פתיחה קצרה בראש כל פרק — משהו שגורם לי להתחיל לקרוא.',
    apply: (l) => ({ ...l, hooks: true }) },
  { id: 'type-scale', kind: 'style', when: (m, l) => l.scale < 1.04,
    ask: 'תגדילו קצת את הטקסט — אני קורא/ת את זה בטלפון.',
    apply: (l) => ({ ...l, scale: 1.06 }) },
  { id: 'measure', kind: 'style', when: (m, l) => l.measure > 66,
    ask: 'תקצרו את אורך השורה.',
    apply: (l) => ({ ...l, measure: 60 }) },
  { id: 'density', kind: 'layout', when: (m, l) => l.density !== 'airy',
    ask: 'תנו אוויר בין הפסקאות, זה דחוס מדי.',
    apply: (l) => ({ ...l, density: 'airy' }) },
  { id: 'accent-rotation', kind: 'style', when: (m, l) => !l.accentRotation,
    ask: 'תנו לכל פרק צבע משלו כדי שלא יתמזגו.',
    apply: (l) => ({ ...l, accentRotation: true }) },
  { id: 'micro-copy', kind: 'framing', when: (m, l) => !l.microCopy,
    ask: 'תכתבו בכריכה מה בדיוק מקבלים — עמודים, איורים, זמן קריאה.',
    apply: (l) => ({ ...l, microCopy: true }) },
  { id: 'toc-cards', kind: 'layout', when: (m, l) => !l.tocCards,
    ask: 'תהפכו את תוכן העניינים לכרטיסים.',
    apply: (l) => ({ ...l, tocCards: true }) },
  { id: 'page-badges', kind: 'layout', when: (m, l) => !l.pageBadges,
    ask: 'תוסיפו סימון "איפה אני בפרק".',
    apply: (l) => ({ ...l, pageBadges: true }) },
  { id: 'pull-quotes', kind: 'style', when: (m, l) => !l.pullQuotes,
    ask: 'תבליטו משפט אחד חזק בכל פרק בגדול.',
    apply: (l) => ({ ...l, pullQuotes: true }) },
  { id: 'chapter-hud', kind: 'layout', when: (m, l) => !l.chapterHud,
    ask: 'תראו לי בתחילת פרק כמה עמודים וכמה דקות.',
    apply: (l) => ({ ...l, chapterHud: true }) },
  { id: 'end-markers', kind: 'framing', when: (m, l) => !l.endMarkers,
    ask: 'בסוף פרק תנו לי טיזר לפרק הבא.',
    apply: (l) => ({ ...l, endMarkers: true }) },
  { id: 'running-footer', kind: 'layout', when: (m, l) => !l.runningFooter,
    ask: 'תוסיפו מספור עמודים אמיתי בתחתית.',
    apply: (l) => ({ ...l, runningFooter: true }) },
  { id: 'paragraph-beats', kind: 'layout', when: (m, l) => m.worstRun > 4 && !l.paragraphBeats,
    ask: 'יש רצף ארוך מדי של פסקאות בלי הפסקה. תשברו את זה ויזואלית.',
    apply: (l) => ({ ...l, paragraphBeats: true }) },
];

const ART_FIXES = [
  { id: 'art-energy', kind: 'visual', when: (m, d) => d.energy !== 'high',
    ask: 'האיורים מסודרים מדי. תנו להם יותר תנועה, יותר קומיקס.',
    apply: (d) => ({ ...d, energy: 'high' }) },
  { id: 'art-contrast', kind: 'visual', when: (m, d) => d.contrast !== 'boosted',
    ask: 'תחזקו את הניגודיות של האיורים, בטלפון בשמש זה נמרח.',
    apply: (d) => ({ ...d, contrast: 'boosted' }) },
  { id: 'caption-voice', kind: 'visual', when: (m, d) => d.captionVoice !== 'punchy',
    ask: 'הכתוביות מנומסות מדי. תדברו אליי.',
    apply: (d) => ({ ...d, captionVoice: 'punchy' }) },
  { id: 'art-humans', kind: 'visual', when: (m, d) => m.humanRatio < 0.16,
    ask: 'כמעט אין דמויות. תכניסו בני נוער לתוך האיורים, לא רק גרפים.',
    apply: (d) => ({ ...d, humanPresence: Math.max(0.2, d.humanPresence + 0.08) }) },
];

/* ── the agent ───────────────────────────────────────────────────────── */

export function runReviewer({ html, visual, editorStats, layout, artDirection, iteration }) {
  const m = measure(html, visual, editorStats);

  const interesting = scoreInteresting(m, layout);
  const looks = scoreLooks(m, layout);
  const value = scoreValue(m, layout);

  const dimensions = {
    'מעניין?': interesting,
    'נראה טוב?': looks,
    'שווה 20 ₪?': value,
  };
  const overall = Math.round((interesting.score + looks.score + value.score) / 3);
  const weakest = Math.min(interesting.score, looks.score, value.score);

  // Ask for at most four changes per round — a real reviewer does not hand over
  // a 12-item list and expect it back in an hour.
  const layoutAsks = FIXES.filter((f) => f.when(m, layout));
  const artAsks = ART_FIXES.filter((f) => f.when(m, artDirection));
  const directives = [...layoutAsks, ...artAsks]
    .slice(0, 4)
    .map((f) => ({ id: f.id, kind: f.kind, ask: f.ask, apply: f.apply }));

  assertDirectives(directives);

  const approved = overall >= PASS_SCORE && weakest >= MIN_DIMENSION && directives.length === 0;

  const verdict = approved
    ? APPROVAL_PHRASE
    : overall >= 80
    ? 'כמעט. עוד סיבוב אחד ואני קונה את זה.'
    : overall >= 65
    ? 'התוכן טוב, העטיפה עוד לא מוכרת אותו.'
    : 'עכשיו זה מרגיש כמו חוברת מבית הספר.';

  return {
    iteration,
    scores: {
      overall,
      interesting: interesting.score,
      looks: looks.score,
      value: value.score,
    },
    dimensions,
    metrics: m,
    verdict,
    approved,
    approvalPhrase: APPROVAL_PHRASE,
    directives: directives.map(({ id, kind, ask }) => ({ id, kind, ask })),
    _directives: directives,
  };
}

export function applyDirectives(review, layout, artDirection) {
  let nextLayout = layout;
  let nextArt = artDirection;
  for (const d of review._directives) {
    if (d.kind === 'visual') nextArt = d.apply(nextArt);
    else nextLayout = d.apply(nextLayout);
  }
  return { layout: nextLayout, artDirection: nextArt };
}
