/**
 * AGENT 1 — VISUAL
 *
 * Reads the sealed source, storyboards it into exactly 50 pages, and for each
 * page produces:
 *   - a Hebrew caption (the page's visual title, printed under the art)
 *   - a detailed English text-to-image prompt for studio re-rendering
 *   - an alt text
 *   - a ready-to-print vector illustration (lib/art.mjs)
 *
 * It never edits a single word of the source. It only decides what is DRAWN.
 */
import { renderArt, PALETTE as P } from '../lib/art.mjs';
import { blockTexts } from '../lib/source.mjs';

export const TARGET_PAGES = 50;

/* ── art direction (mutated by Teen Reviewer 'visual' directives) ────── */

export const baseArtDirection = {
  energy: 'medium',        // medium | high
  humanPresence: 0.30,     // share of pages that must show a character
  captionVoice: 'plain',   // plain | punchy
  contrast: 'standard',    // standard | boosted
};

const STYLE_BASE =
  'flat vector illustration, bold geometric shapes, thick 4px strokes, rounded joins, ' +
  'gaming HUD language (brackets, progress bars, chips), deep navy #0E1424 panel with ' +
  'a subtle 40px grid, palette limited to lime #B8FF3C, violet #6A4BFF, coral #FF5A5F, ' +
  'teal #19C4B2, gold #FFB020 on warm off-white #FAF6EE, no photorealism, no drop shadows, ' +
  'no lens flare, no text artifacts, poster-clean composition, 16:9';

const ENERGY_HINT = {
  medium: 'calm confident staging, generous negative space',
  high: 'dynamic diagonal composition, motion streaks, comic-panel energy, slight tilt',
};

const CONTRAST_HINT = {
  standard: 'balanced value structure',
  boosted: 'high contrast, near-black background, accent colour at full saturation',
};

export function stylePrompt(dir) {
  return `${STYLE_BASE}, ${ENERGY_HINT[dir.energy]}, ${CONTRAST_HINT[dir.contrast]}`;
}

/* ── weighting & pagination ──────────────────────────────────────────── */

function weight(block) {
  switch (block.type) {
    case 'p': return 1 + Math.min(2, block.text.length / 90);
    case 'quote': return 1.4;
    case 'note':
    case 'rule': return 1.8;
    case 'list':
    case 'olist': return 1 + block.items.length * 0.55;
    case 'checklist': return 1.2 + block.items.length * 0.6;
    case 'table': return 1.6 + block.rows.length * 0.7;
    case 'group': return 1.4 + block.blocks.reduce((n, b) => n + weight(b), 0);
    default: return 1;
  }
}

/** Sections become units; heavy sections split at block boundaries. */
function buildUnits(doc, maxUnit) {
  const units = [];
  for (const chapter of doc.chapters) {
    for (const section of chapter.sections) {
      const w = section.blocks.reduce((n, b) => n + weight(b), 0);
      if (w <= maxUnit) {
        units.push({ chapter, section, blocks: section.blocks, weight: w, part: 0, parts: 1 });
        continue;
      }
      const target = w / Math.ceil(w / maxUnit);
      let cur = [], curW = 0;
      const chunks = [];
      for (const b of section.blocks) {
        const bw = weight(b);
        if (curW && curW + bw > target * 1.25) chunks.push({ blocks: cur, weight: curW }), (cur = []), (curW = 0);
        cur.push(b); curW += bw;
      }
      if (cur.length) chunks.push({ blocks: cur, weight: curW });
      chunks.forEach((c, i) =>
        units.push({ chapter, section, blocks: c.blocks, weight: c.weight, part: i, parts: chunks.length })
      );
    }
  }
  return units;
}

function packPages(units, target) {
  const total = units.reduce((n, u) => n + u.weight, 0);
  let ideal = total / target;
  const pack = (cap) => {
    const pages = [];
    let cur = null;
    for (const u of units) {
      const newChapter = !cur || cur.chapter !== u.chapter;
      if (newChapter || cur.weight + u.weight > cap) {
        cur = { chapter: u.chapter, units: [u], weight: u.weight };
        pages.push(cur);
      } else {
        cur.units.push(u);
        cur.weight += u.weight;
      }
    }
    return pages;
  };

  // binary-search the cap so the packer lands on the requested page count
  let lo = 1, hi = total, pages = pack(ideal);
  for (let i = 0; i < 40 && pages.length !== target; i++) {
    const mid = (lo + hi) / 2;
    pages = pack(mid);
    if (pages.length > target) lo = mid; else hi = mid;
  }
  // exact landing: split the heaviest page / merge the lightest neighbours
  let guard = 0;
  while (pages.length > target && guard++ < 200) {
    let bi = -1, bw = Infinity;
    for (let i = 1; i < pages.length; i++) {
      if (pages[i].chapter !== pages[i - 1].chapter) continue;
      const w = pages[i].weight + pages[i - 1].weight;
      if (w < bw) bw = w, bi = i;
    }
    if (bi < 0) break;
    pages[bi - 1].units.push(...pages[bi].units);
    pages[bi - 1].weight += pages[bi].weight;
    pages.splice(bi, 1);
  }
  while (pages.length < target && guard++ < 200) {
    let bi = -1, bw = -1;
    pages.forEach((p, i) => { if (p.units.length > 1 && p.weight > bw) bw = p.weight, bi = i; });
    if (bi < 0) break;
    const p = pages[bi];
    const half = p.weight / 2;
    let acc = 0, cut = 1;
    for (let i = 0; i < p.units.length - 1; i++) { acc += p.units[i].weight; if (acc >= half) { cut = i + 1; break; } cut = i + 1; }
    const rest = p.units.splice(cut);
    p.weight = p.units.reduce((n, u) => n + u.weight, 0);
    pages.splice(bi + 1, 0, { chapter: p.chapter, units: rest, weight: rest.reduce((n, u) => n + u.weight, 0) });
  }
  return pages;
}

/* ── concept library ─────────────────────────────────────────────────── */

const C = {
  lime: P.lime, coral: P.coral, violet: P.violet, violetSoft: P.violetSoft,
  teal: P.teal, gold: P.gold,
};

const COVER = () => ({
  archetype: 'cover',
  config: { big: '5,000 ₪', sub: 'המשחק הפיננסי שלך', tag: 'START GAME' },
  caption: 'הכסף נכנס. עכשיו מתחיל המשחק האמיתי.',
  prompt: 'A hero opening spread: five oversized golden shekel coins arranged in a rising arc over a dark HUD panel, a violet glow disc behind them, corner brackets framing the scene, a coral "START" chip at the bottom.',
});

/** [matcher, concept builder] — first match wins. */
const LIBRARY = [
  ['opener:1', () => ({
    archetype: 'chat',
    config: {
      messages: [
        { text: 'המוח: חופשה!', w: 0.4 },
        { text: 'החברים: יאללה, יוצאים!', w: 0.52 },
        { text: 'האינטרנט: מבצע אחרון!!!', w: 0.56 },
        { text: 'העתיד: אולי תשאירו לי משהו?', me: true, w: 0.6 },
      ],
    },
    caption: 'ארבעה קולות צועקים על הכסף שלכם. אחד מהם לוחש.',
    prompt: 'A group-chat panel with four stacked bubbles representing the brain, the friends, the internet and the future arguing over one wallet, the last bubble in violet and quieter, dark HUD panel.',
  })],
  ['title:הדילמה הגדולה', () => ({
    archetype: 'inventory',
    config: {
      title: 'מה אני רוצה?', cols: 4, rows: 2,
      items: [
        { label: 'חופשה', color: C.lime, badge: 'x1' }, { label: 'טלפון', color: C.violetSoft },
        { label: 'רישיון', color: C.teal }, { label: 'קטנוע', color: C.coral },
        { label: 'מחשב', color: C.gold }, { label: 'לימודים', color: C.violetSoft },
        { label: 'כסף בצד', color: C.lime }, { label: 'לחיות', color: C.coral, badge: '!' },
      ],
    },
    caption: 'תיק הציוד של גיל 16: שמונה רצונות, ארנק אחד.',
    prompt: 'A game inventory grid of eight glowing item slots, each holding a simple icon of a teenage want — a plane ticket, a phone, a driving licence, a scooter, a laptop, a graduation cap, a coin stack, a heart — with one slot pulsing.',
  })],
  ['title:למה בכלל לחלק?', () => ({
    archetype: 'hudPie',
    config: {
      center: '5,000',
      parts: [
        { pct: 40, label: 'חופשה ויעדים קרובים', color: C.lime },
        { pct: 30, label: 'קופת חירום', color: C.coral },
        { pct: 20, label: 'טווח ארוך', color: C.violetSoft },
        { pct: 10, label: 'בזבוזים', color: C.gold },
      ],
    },
    caption: 'מודל 40/30/20/10 — נקודת פתיחה, לא חוק טבע.',
    prompt: 'A clean HUD donut chart split 40/30/20/10 in lime, coral, violet and gold, the total 5,000 set in the middle, a legend column beside it, corner brackets, dark navy grid background.',
  })],
  ['title:ארבעת הארנקים', () => ({
    archetype: 'wallets',
    config: {
      items: [
        { label: 'ארנק החופש', amount: '2,000 ₪', note: 'מטרה קרובה', color: C.lime },
        { label: 'השכפ"ץ', amount: '1,500 ₪', note: 'חירום', color: C.coral },
        { label: 'העתיד', amount: '1,000 ₪', note: 'טווח ארוך', color: C.violetSoft },
        { label: 'כסף חופשי', amount: '500 ₪', note: 'בלי אשמה', color: C.gold },
      ],
    },
    caption: 'ארבעה ארנקים. לכל שקל יש שם ותפקיד.',
    prompt: 'Four upright wallet cards standing side by side like game loadout slots, each in a different accent colour with its amount printed large, thin outline, dark HUD backdrop with corner brackets.',
  })],
  ['title:Case Study — דניאל והחופשה', () => ({
    archetype: 'scene',
    config: {
      say: 'אני אוציא רק|2,000 על החופשה', mood: 'shock', color: C.gold, prop: 'suitcase',
      tag: 'ואז הגיעו כל הקטנים',
    },
    caption: 'דניאל תכנן 2,000 ₪ — לפני שהוסיף את כל השאר.',
    prompt: 'Comic panel: a teenager with a suitcase, confident speech bubble reading a budget number, while small ghosted receipts drift in from the edge of the frame; flat vector, violet hoodie, gold suitcase.',
  })],
  ['title:טיפ הזהב שחוסך 100 ₪|chapter:2', () => ({
    archetype: 'ledger',
    config: {
      title: 'לפרק את ה-2,000',
      cols: 2,
      rows: [['סעיף', 'כמה'], ['טיסה', '___ ₪'], ['לינה', '___ ₪'], ['אוכל', '___ ₪'], ['אקסטרות', '___ ₪']],
    },
    caption: 'אם אתם לא יודעים מה בפנים — אתם לא יודעים כמה זה עולה.',
    prompt: 'A HUD budget breakdown table with four empty amount fields, a violet header row, blank lines waiting to be filled, framed by corner brackets on a dark grid.',
  })],
  ['title:משימת היומן|chapter:2', () => ({
    archetype: 'target',
    config: {
      rows: [
        { k: 'מטרה קרובה', pct: 0.4, color: C.lime },
        { k: 'חירום', pct: 0.3, color: C.coral },
        { k: 'עתיד', pct: 0.2, color: C.violetSoft },
        { k: 'בזבוזים', pct: 0.1, color: C.gold },
      ],
    },
    caption: 'משימה ראשונה: לחלק את המספר שלכם לארבעה חלקים.',
    prompt: 'A dartboard hit dead centre by an arrow, next to four labelled progress bars at 40/30/20/10, flat vector, lime and coral accents on dark navy.',
  })],

  ['opener:3', () => ({
    archetype: 'shield',
    config: { big: '1,500', label: 'שכפ"ץ פיננסי', pct: 0.75 },
    caption: 'השריון של הארנק: קיים בשביל המכה שלא תכננתם.',
    prompt: 'A chunky game shield icon rendered in teal outline on dark navy, an armour value printed across it, a health bar beneath, corner brackets, flat vector.',
  })],
  ['title:מהי קופת חירום?', () => ({
    archetype: 'versus',
    config: {
      left: 'כן — חירום', right: 'לא — לא חירום',
      leftItems: ['מכשיר חיוני שנשבר', 'הוצאה דחופה', 'תיקון לא מתוכנן'],
      rightItems: ['נעליים שרציתם', 'מסעדה עם חברים', '"מבצע מטורף"'],
    },
    caption: 'מבצע הוא לא מצב חירום.',
    prompt: 'A split-screen comparison panel: teal side with genuine emergencies, coral side with tempting non-emergencies, a VS badge in the middle, dashed divider, flat vector HUD.',
  })],
  ['title:כלל הברזל', () => ({
    archetype: 'rules',
    config: {
      title: 'ארבע שאלות לפני שנוגעים',
      items: ['האם ההוצאה בלתי צפויה?', 'האם היא באמת נחוצה?', 'האם אפשר לדחות אותה?', 'האם יש דרך זולה יותר?'],
    },
    caption: 'ארבע שאלות שעומדות בין הכסף לבין הכפתור.',
    prompt: 'A vertical stack of four numbered rule chips with violet number badges on a dark HUD panel, lime title, corner brackets.',
  })],
  ['title:Case Study — מאיה והטלפון', () => ({
    archetype: 'scene',
    config: { say: 'להחזיר לקופה|את מה שהוצאתי', mood: 'calm', color: C.coral, prop: 'phoneBroken', tag: 'תיקון: 350 ₪' },
    caption: 'מאיה שילמה 350 ₪ — ואז מילאה את הקופה בחזרה.',
    prompt: 'Comic panel: a calm teenager beside a cracked phone, a repair price tag, and a small refill arrow looping back into a coral piggy icon; flat vector.',
  })],
  ['title:צ\'ק-ליסט סוף הפרק', () => ({
    archetype: 'phone',
    config: {
      title: 'צ׳ק-ליסט חירום',
      rows: [
        { label: 'יש לי כסף לחירום', on: true },
        { label: 'אני יודע/ת למה הוא', on: true },
        { label: 'ולמה הוא לא', on: true },
        { label: 'הוא לא נגיש מדי', on: false },
        { label: 'אני יודע/ת להחזיר', on: false },
      ],
      foot: 'SAVE',
    },
    caption: 'חמש שורות שאומרות אם השכפ"ץ שלכם באמת עובד.',
    prompt: 'A phone mockup on a dark HUD panel showing a five-row checklist with teal check marks, a violet save chip at the bottom, flat vector.',
  })],

  ['opener:4', () => ({
    archetype: 'boss',
    config: {
      title: 'ארבעת הבוסים של החופשה',
      bars: [
        { label: 'הגעה', pct: 0.8, color: C.violetSoft, value: 'BOSS 1' },
        { label: 'לינה', pct: 0.65, color: C.teal, value: 'BOSS 2' },
        { label: 'אוכל', pct: 0.5, color: C.gold, value: 'BOSS 3' },
        { label: 'אקסטרות', pct: 0.95, color: C.coral, value: 'BOSS 4' },
      ],
    },
    caption: 'החופשה היא ארבעה בוסים. האחרון תמיד הכי מסוכן.',
    prompt: 'Four stacked boss health bars labelled travel, stay, food and extras, the last one nearly full in coral, a bold title above, dark HUD panel with corner brackets.',
  })],
  ['title:שיטת שלושת המספרים', () => ({
    archetype: 'boss',
    config: {
      title: 'שלושת המספרים',
      bars: [
        { label: 'תקציב אידיאלי', pct: 0.8, color: C.lime, value: '1,600 ₪' },
        { label: 'תקציב מקסימלי', pct: 1, color: C.gold, value: '2,000 ₪' },
        { label: 'קו אדום', pct: 1, color: C.coral, value: '2,000 ₪' },
      ],
    },
    caption: 'אידיאלי, מקסימלי, קו אדום — ובקו האדום עוצרים.',
    prompt: 'Three horizontal gauges stacked, the third one glowing coral and marked as a red line, a stop marker at its end, dark HUD, flat vector.',
  })],
  ['title:Case Study — רועי והאקסטרות', () => ({
    archetype: 'receipt',
    config: {
      title: 'רועי — מאזן חופשה',
      lines: [
        { k: 'תוכנן', v: '1,800 ₪' },
        { k: 'נשאר', v: '100 ₪' },
        { k: 'אטרקציה נוספת', v: '180 ₪', hot: true },
      ],
      stamp: 'ויתרתי — ולא נכנסתי למינוס',
    },
    caption: 'נשארו 100 ₪, האטרקציה עלתה 180. רועי אמר לא.',
    prompt: 'A torn paper receipt on a dark panel listing a planned budget, the remaining balance and an over-budget line in coral, stamped with a tilted decision badge.',
  })],

  ['opener:5', () => ({
    archetype: 'scene',
    config: { say: 'יאללה, קנה.', mood: 'shock', color: C.coral, prop: 'cart', tag: 'האימפולס — אויב העל של הארנק' },
    caption: 'תכירו את אויב העל: האימפולס.',
    prompt: 'Comic panel: a hooded impulse character shoving a glowing shopping cart towards a startled teenager, coral energy streaks, flat vector villain staging.',
  })],
  ['title:למה כל כך קל לקנות?', () => ({
    archetype: 'inventory',
    config: {
      title: 'הטריקים של החנות', cols: 3, rows: 2,
      items: [
        { label: 'מבצע מוגבל', color: C.coral }, { label: 'ספירה לאחור', color: C.gold },
        { label: '"רק היום"', color: C.coral }, { label: 'משלוח חינם', color: C.teal },
        { label: 'המלצות', color: C.violetSoft }, { label: 'כפתור קל', color: C.lime, badge: '1' },
      ],
    },
    caption: 'שישה טריקים שנועדו לגרום לכם לחשוב פחות.',
    prompt: 'Six UI trick cards laid out in a grid — countdown timer, limited badge, free-shipping bar, recommendation carousel, one-tap buy button — each in its own outlined slot on a dark HUD.',
  })],
  ['title:חוק 48 השעות', () => ({
    archetype: 'timer',
    config: { big: '48', unit: 'שעות', caption: 'לא חיוני? הכפתור מחכה.' },
    caption: 'חוק 48 השעות: הרצון האמיתי שורד, השאר מתאדה.',
    prompt: 'A large circular countdown dial reading 48 hours, gold ring progress, dashed orbit, a small locked buy-button icon beside it, dark HUD panel.',
  })],
  ['title:רוצה או צריך?', () => ({
    archetype: 'versus',
    config: {
      left: 'צריך', right: 'רוצה',
      leftItems: ['תרופה', 'ציוד לימודי', 'תיק תקין', 'נסיעה חשובה'],
      rightItems: ['משחק', 'אביזר חדש', 'תיק כי הוא יפה', 'מונית'],
    },
    caption: '"רוצה" זה לגיטימי. הבעיה היא כשהוא מתחפש ל"צריך".',
    prompt: 'A two-column comparison board, teal needs on one side, coral wants on the other, a VS badge dividing them, flat vector HUD styling.',
  })],
  ['title:Case Study — יובל והנעליים', () => ({
    archetype: 'receipt',
    config: {
      title: 'יובל — נעליים',
      lines: [{ k: 'מחיר', v: '450 ₪' }, { k: '"חסכתי"', v: '193 ₪' }, { k: 'הוצאתי בפועל', v: '450 ₪', hot: true }],
      stamp: 'נשארו אצלי 450 ₪',
    },
    caption: 'לשלם 450 זה לא לחסוך 193.',
    prompt: 'A receipt showing a discount price, a struck-through "saved" line, and the real amount spent highlighted in coral, a tilted stamp with the final decision, dark panel.',
  })],
  ['title:טיפ הזהב שחוסך 100 ₪|chapter:5', () => ({
    archetype: 'versus',
    config: {
      left: 'שאלה נכונה', right: 'שאלה מטעה',
      leftItems: ['כמה אני מוציא?'], rightItems: ['כמה אני חוסך?'],
    },
    caption: 'שאלה אחת מחליפה את כל השיווק.',
    prompt: 'Two speech bubbles facing each other on a split panel, one teal and one coral, a VS badge between them, minimal flat vector.',
  })],

  ['opener:6', () => ({
    archetype: 'snowball',
    config: {
      title: 'אפקט כדור השלג',
      points: [1000, 1070, 1403, 1967],
      labels: ['היום', 'שנה', '5 שנים', '10 שנים'],
    },
    caption: 'כדור קטן מתחיל להתגלגל — וגדל עם הזמן.',
    prompt: 'A rising teal curve across a dark HUD chart, snowballs growing at each node, values labelled above, an area fill under the line, corner brackets.',
  })],
  ['title:ריבית דריבית', () => ({
    archetype: 'rules',
    config: {
      title: 'איך זה עובד',
      items: ['מרוויחים על הכסף', 'הרווח נשאר מושקע', 'מרוויחים גם על הרווח', 'אבל הערך יכול גם לרדת'],
    },
    caption: 'רווח על הרווח — עם סימן אזהרה בסוף.',
    prompt: 'Four stacked explainer chips describing compounding, the last one in coral as a warning, violet number badges, dark HUD panel.',
  })],
  ['title:דוגמה פשוטה', () => ({
    archetype: 'ledger',
    config: {
      title: '1,000 ₪ ב-7% (להמחשה בלבד)',
      cols: 2,
      rows: [['זמן', 'שווי'], ['התחלה', '1,000 ₪'], ['שנה', '1,070 ₪'], ['5 שנים', '1,403 ₪'], ['10 שנים', '1,967 ₪']],
    },
    caption: 'המספרים הם דוגמה מתמטית — לא הבטחה.',
    prompt: 'A four-row data table on a dark HUD panel with a violet header, monospace-feel numbers, a small disclaimer chip in the corner.',
  })],
  ['title:למה הגיל חשוב?', () => ({
    archetype: 'timer',
    config: { big: '10+', unit: 'שנים', caption: 'המשאב שאי אפשר לקנות' },
    caption: 'יש לכם משאב שמבוגרים לא יכולים לקנות: זמן.',
    prompt: 'An hourglass reimagined as a HUD dial with years instead of minutes, gold ring, a small coin falling through the neck, dark navy background.',
  })],
  ['title:Case Study — תומר והכסף שהוא שכח', () => ({
    archetype: 'scene',
    config: { say: 'כסף הוא כלי|לטווח ארוך', mood: 'happy', color: C.teal, prop: 'laptop', tag: 'למד לפני שהחליט' },
    caption: 'תומר לא חיפש מניה. הוא חיפש הבנה.',
    prompt: 'Comic panel: a teenager at a laptop reading a rising chart, a parent silhouette beside them, calm teal palette, flat vector.',
  })],

  ['opener:7', () => ({
    archetype: 'skills',
    config: {
      root: 'SKILL',
      nodes: [
        { label: 'עריכת וידאו', color: C.lime }, { label: 'צילום', color: C.teal },
        { label: 'עיצוב', color: C.violetSoft }, { label: 'תיקונים', color: C.gold },
      ],
    },
    caption: 'הכישרון שלכם הוא Character Skill — עכשיו מחברים אותו לערך.',
    prompt: 'A skill-tree graph: a central violet node labelled SKILL with four branches leading to labelled ability cards, glowing connector lines, dark HUD panel.',
  })],
  ['title:נוסחת שירות פשוטה', () => ({
    archetype: 'rules',
    config: {
      title: 'הנוסחה',
      items: ['מי צריך עזרה', 'במה אני טוב/ה', 'מה התוצאה', '= שירות שאפשר למכור'],
    },
    caption: 'שלושה חלקים שהופכים כישרון לשירות.',
    prompt: 'Three chips connected by plus signs leading to an equals chip, a formula laid out horizontally on a dark HUD, lime accent on the result.',
  })],
  ['title:Case Study — נועה והעריכה', () => ({
    archetype: 'scene',
    config: { say: 'התחלתי עם מה|שכבר היה לי', mood: 'happy', color: C.lime, prop: 'laptop', tag: 'לקוח ראשון' },
    caption: 'נועה לא קנתה ציוד. היא השתמשה טוב יותר במה שהיה.',
    prompt: 'Comic panel: a teenager editing video on an old laptop, a first-client notification popping in, lime accents, flat vector.',
  })],
  ['title:משימת היומן|chapter:7', () => ({
    archetype: 'ledger',
    config: {
      title: '5 דברים שאני יודע/ת לעשות',
      cols: 3,
      rows: [['מיומנות', 'מי צריך', 'זמן'], ['___', '___', '___'], ['___', '___', '___'], ['___', '___', '___']],
    },
    caption: 'חמש שורות שהופכות "אני טוב ב..." לתוכנית.',
    prompt: 'A blank three-column worksheet table on a dark HUD panel, violet header row, empty fields with underscores, corner brackets.',
  })],

  ['opener:8', () => ({
    archetype: 'tap',
    config: { cardLabel: 'TAP TO PAY', caption: 'שטר נעלם מול העיניים. לחיצה — לא.', tag: 'המלכודת הדיגיטלית' },
    caption: 'כשמשלמים בלחיצה, המוח כמעט לא מרגיש.',
    prompt: 'A violet contactless card mid-tap with lime signal arcs radiating from it, a gold chip detail, dark HUD panel, flat vector.',
  })],
  ['title:10 שניות ביום', () => ({
    archetype: 'phone',
    config: {
      title: 'כמה הוצאתי היום?',
      rows: [{ label: '12 ₪', on: true }, { label: '35 ₪', on: true }, { label: '0 ₪', on: false }, { label: '58 ₪', on: true }],
      foot: '10 שניות',
    },
    caption: 'הרגל של עשר שניות — רק להסתכל על המספר.',
    prompt: 'A phone screen showing a short daily spend list with a bold total, a ten-second timer chip at the bottom, dark HUD frame.',
  })],
  ['title:"אבל יש לי כסף בחשבון!"', () => ({
    archetype: 'wallets',
    config: {
      items: [
        { label: 'חופשה', amount: '800 ₪', note: 'תפוס', color: C.violetSoft },
        { label: 'חירום', amount: '500 ₪', note: 'תפוס', color: C.coral },
        { label: 'מטרה', amount: '400 ₪', note: 'תפוס', color: C.teal },
        { label: 'פנוי', amount: '300 ₪', note: 'זה המספר', color: C.lime },
      ],
    },
    caption: '2,000 ₪ בחשבון. 300 ₪ באמת פנויים.',
    prompt: 'Four allocation cards where three are dimmed and locked and the fourth glows lime as the only truly free money, dark HUD, flat vector.',
  })],
  ['title:Case Study — אדם והאשליה', () => ({
    archetype: 'stack',
    config: { title: 'ארבע קניות קטנות', values: [30, 45, 70, 25] },
    caption: '30 + 45 + 70 + 25. "לא קניתי שום דבר גדול."',
    prompt: 'Four small violet bars beside one tall coral bar equal to their sum, values labelled, a baseline rule, dark HUD panel.',
  })],

  ['opener:9', () => ({
    archetype: 'chat',
    config: {
      messages: [
        { text: 'יאללה, כולם באים', w: 0.44 },
        { text: 'אני לא יכול', me: true, w: 0.36 },
        { text: 'עכשיו כולם יחשבו|שאני קמצן', w: 0.5 },
      ],
    },
    caption: 'הקושי האמיתי הוא לא התקציב. הוא הקבוצה.',
    prompt: 'A group-chat mockup with three message bubbles, one violet outgoing bubble and two grey incoming, social pressure staging, dark HUD panel.',
  })],
  ['title:משפטים שעובדים', () => ({
    archetype: 'chat',
    config: {
      messages: [
        { text: 'לא בתקציב שלי הפעם', me: true, w: 0.5 },
        { text: 'אני בא, אבל לא מוציא על זה', me: true, w: 0.56 },
        { text: 'יש משהו זול יותר?', me: true, w: 0.46 },
      ],
    },
    caption: 'ארבעה משפטים. בלי הרצאה של 40 דקות.',
    prompt: 'Three confident outgoing chat bubbles in violet stacked on a dark panel, short assertive lines, no incoming bubbles, flat vector.',
  })],
  ['title:Case Study — איתן והמסעדה', () => ({
    archetype: 'scene',
    config: { say: 'אני מצטרף, אבל|לוקח בתקציב שלי', mood: 'happy', color: C.violet, tag: 'אחרי דקה כולם המשיכו הלאה' },
    caption: 'איתן הצטרף — בתנאים שלו.',
    prompt: 'Comic panel: a teenager at a restaurant table with friends, holding a modest order, a calm speech bubble, warm violet lighting, flat vector.',
  })],

  ['opener:10', () => ({
    archetype: 'rules',
    config: {
      title: 'ארבע טעויות שעולות כסף',
      items: ['הלוואות לחברים', 'טרנדים', 'קופסאות הפתעה', 'לקנות כדי להרגיש עשיר'],
    },
    caption: 'ארבע טעויות שאפשר ללמוד בזול — מכאן.',
    prompt: 'Four numbered warning chips stacked on a dark HUD panel with a coral title, small hazard marks, flat vector.',
  })],
  ['title:טעות 3: קופסאות הפתעה', () => ({
    archetype: 'loot',
    config: { title: 'קופסת הפתעה', caption: 'מה שמקבלים — לא מובטח.' },
    caption: 'הבעיה היא לא המחיר. היא חוסר הוודאות.',
    prompt: 'A violet loot box half-open with three coloured orbs escaping, a question-mark keyhole, coral warning caption below, dark HUD panel.',
  })],
  ['title:Case Study — עומר והטרנד', () => ({
    archetype: 'stack',
    config: { title: 'עומר — 600 ₪ על טרנדים', values: [180, 150, 140, 130] },
    caption: '600 ₪ על ויראלי. שבועיים אחר כך — כמעט לא בשימוש.',
    prompt: 'Four violet purchase bars summing into one coral total bar, a dust layer over the items, dark HUD panel, flat vector.',
  })],

  ['opener:11', () => ({
    archetype: 'target',
    config: {
      rows: [
        { k: 'ספציפית', pct: 1, color: C.lime },
        { k: 'מדידה', pct: 0.8, color: C.teal },
        { k: 'עם תאריך', pct: 0.6, color: C.gold },
      ],
    },
    caption: 'מטרה טובה: ספציפית + מדידה + עם תאריך.',
    prompt: 'A target with a centred arrow beside three labelled progress meters, lime teal and gold, dark HUD panel with corner brackets.',
  })],
  ['title:שלב 3 — הכירו את המספר החודשי שלכם', () => ({
    archetype: 'ledger',
    config: {
      title: 'יומן הוצאות — חודש',
      cols: 3,
      rows: [['תאריך', 'מה קניתי', 'סכום'], ['___', '___', '___ ₪'], ['___', '___', '___ ₪'], ['___', '___', '___ ₪']],
    },
    caption: 'חודש אחד של מעקב שווה יותר משנה של ניחושים.',
    prompt: 'A blank spending-log table with a violet header row and three empty rows on a dark HUD panel, pen-ready underscores.',
  })],
  ['title:צ\'ק-ליסט: לפני קנייה', () => ({
    archetype: 'phone',
    config: {
      title: 'לפני שלוחצים "קנה"',
      rows: [
        { label: 'באמת רוצה?', on: true }, { label: 'באמת צריך?', on: true },
        { label: 'חיכיתי 48 שעות?', on: false }, { label: 'נכנס בתקציב?', on: true },
        { label: 'בדקתי חלופות?', on: false },
      ],
      foot: 'STOP',
    },
    caption: 'שבע שאלות. שתי תשובות "לא" — עוצרים.',
    prompt: 'A phone checkout screen replaced by a checklist gate, two unchecked rows glowing coral, a STOP chip at the bottom, dark HUD frame.',
  })],
  ['title:האתגר: 30 ימים של שליטה בכסף', () => ({
    archetype: 'quest',
    config: {
      title: 'אתגר 30 יום',
      nodes: [
        { badge: '1-7', label: 'מודעות', color: C.lime },
        { badge: '8-14', label: 'עצירת דליפות', color: C.teal },
        { badge: '15-21', label: 'הגדלת הכנסה', color: C.gold },
        { badge: '22-30', label: 'בניית מערכת', color: C.coral },
      ],
    },
    caption: 'ארבעה שלבים, שלושים ימים, מערכת אחת בסוף.',
    prompt: 'A quest map path with four milestone nodes connected by a dotted route across a dark HUD panel, each node in a different accent colour with a label beneath.',
  })],
  ['title:פרויקט הסיום: "5,000 ₪ שלי"', () => ({
    archetype: 'ledger',
    config: {
      title: 'פרויקט הסיום',
      cols: 2,
      rows: [['שאלה', 'התשובה שלי'], ['מה אני רוצה?', '___'], ['כמה זה עולה?', '___ ₪'], ['לחירום', '___ ₪'], ['לטווח ארוך', '___ ₪']],
    },
    caption: 'שמונה שאלות. אחריהן יש לכם תוכנית, לא כוונה.',
    prompt: 'A final worksheet card with a violet header and blank answer fields, a completion badge in the corner, dark HUD panel.',
  })],

  ['opener:12', () => ({
    archetype: 'wallets',
    config: {
      items: [
        { label: 'חופשה', amount: '2,000 ₪', note: 'עכשיו', color: C.lime },
        { label: 'שכפ"ץ', amount: '1,500 ₪', note: 'ביטחון', color: C.coral },
        { label: 'עתיד', amount: '1,000 ₪', note: 'זמן', color: C.violetSoft },
        { label: 'כיף', amount: '500 ₪', note: 'בלי אשמה', color: C.gold },
      ],
    },
    caption: 'אפשר לחיות עכשיו וגם להתכונן לאחר כך.',
    prompt: 'The four wallet cards from the opening, now all filled and glowing, a subtle completion tick above the row, dark HUD panel.',
  })],
  ['opener:13', () => ({
    archetype: 'rules',
    config: {
      title: 'עשרת חוקי הכסף שלי',
      items: ['יודע כמה יש', 'יודע כמה פנוי', 'חירום ≠ בזבוז', '48 שעות', 'מבצע ≠ חיסכון', 'לא קונה שייכות'],
    },
    caption: 'הדף היחיד שכדאי לשמור בטלפון.',
    prompt: 'A phone lock-screen card listing short numbered money rules with violet badges, lime title, dark HUD panel, poster-clean.',
  })],
  ['title:המבחן האחרון', () => ({
    archetype: 'trophy',
    config: { title: 'שליטה', caption: 'לא הפכתם למיליונרים. קיבלתם משהו שימושי יותר.' },
    caption: 'המבחן האחרון: לדעת בדיוק לאן הולכים ה-1,000 הבאים.',
    prompt: 'A gold trophy on a dark panel with a lime glow disc behind it, a completion caption beneath, corner brackets, flat vector.',
  })],
];

/* ── heuristic fallbacks ─────────────────────────────────────────────── */

function heuristicConcept(page, seq) {
  const blocks = page.units.flatMap((u) => u.blocks);
  const title = page.units[0].section.title || page.chapter.title;
  const kinds = new Set(blocks.map((b) => b.type));
  const groups = blocks.filter((b) => b.type === 'group');
  const texts = blocks.flatMap(blockTexts);
  const first = texts[0] || '';

  if (kinds.has('checklist')) {
    const items = blocks.find((b) => b.type === 'checklist').items;
    return {
      archetype: 'phone',
      config: { title: title.slice(0, 24), rows: items.slice(0, 5).map((l, i) => ({ label: l.slice(0, 22), on: i % 2 === 0 })), foot: 'CHECK' },
      caption: 'צ׳ק-ליסט לסימון — לא לקריאה.',
      prompt: 'A phone screen showing a short checklist with mixed checked and unchecked rows, dark HUD frame, flat vector.',
    };
  }
  if (kinds.has('table')) {
    const tb = blocks.find((b) => b.type === 'table');
    return {
      archetype: 'ledger',
      config: { title: title.slice(0, 26), cols: Math.min(3, tb.head.length), rows: [tb.head, ...tb.rows].slice(0, 5) },
      caption: 'המספרים על השולחן.',
      prompt: 'A compact data table on a dark HUD panel with a violet header row and clean numeric rows.',
    };
  }
  if (groups.length >= 3) {
    return {
      archetype: 'boss',
      config: {
        title: title.slice(0, 26),
        bars: groups.slice(0, 4).map((g, i) => ({
          label: g.label.slice(0, 20), pct: 0.45 + i * 0.17, color: [C.violetSoft, C.teal, C.gold, C.coral][i],
        })),
      },
      caption: 'ארבעה שלבים, שורה אחר שורה.',
      prompt: 'A stack of labelled HUD gauges representing sequential stages, ascending fill levels, dark panel with corner brackets.',
    };
  }
  if (kinds.has('quote')) {
    const q = blocks.find((b) => b.type === 'quote').text.replace(/^"|"$/g, '');
    return {
      archetype: 'chat',
      config: { messages: [{ text: q.slice(0, 46), w: 0.56 }, { text: first.slice(0, 34), me: true, w: 0.46 }] },
      caption: 'המשפט שנאמר — והתשובה שאתם בוחרים.',
      prompt: 'Two chat bubbles on a dark panel, one incoming grey and one outgoing violet, short assertive text, flat vector.',
    };
  }
  if (kinds.has('list') || kinds.has('olist')) {
    const l = blocks.find((b) => b.type === 'list' || b.type === 'olist');
    return {
      archetype: 'rules',
      config: { title: title.slice(0, 26), items: l.items.slice(0, 5).map((s) => s.replace(/\.$/, '').slice(0, 30)) },
      caption: 'הרשימה שמסדרת את הראש.',
      prompt: 'A stack of numbered rule chips with violet badges on a dark HUD panel, lime title, corner brackets.',
    };
  }
  const archetypes = ['scene', 'target', 'timer', 'shield'];
  return {
    archetype: archetypes[seq % archetypes.length],
    config: { say: first.slice(0, 34), tag: title.slice(0, 26), big: '', label: title.slice(0, 20), caption: '', mood: 'calm', color: C.violet },
    caption: title.slice(0, 46),
    prompt: `A flat vector HUD panel illustrating the idea of "${title}", geometric shapes only, no literal text.`,
  };
}

/* ── caption voice ───────────────────────────────────────────────────── */

function voiceCaption(caption, dir, page) {
  if (dir.captionVoice !== 'punchy') return caption;
  const n = page.number;
  const stingers = ['בלי דרמות:', 'שורה תחתונה:', 'תזכרו את זה:', 'זהו הטריק:', 'קצר וברור:'];
  if (caption.length > 46) return caption;
  return `${stingers[n % stingers.length]} ${caption}`;
}

/* ── the agent ───────────────────────────────────────────────────────── */

function matches(key, page) {
  const [kind, value] = key.split(':');
  if (kind === 'opener') return page.isChapterOpener && page.chapter.index === Number(value);
  if (kind === 'title') {
    return page.units.some((u) => u.section.title === value && u.part === 0);
  }
  return false;
}

export function runVisual(doc, dir = baseArtDirection, opts = {}) {
  const maxUnit = opts.maxUnit || 13;
  const units = buildUnits(doc, maxUnit);
  const packed = packPages(units, TARGET_PAGES - 1); // page 1 is the cover

  const pages = [{ number: 1, kind: 'cover', chapter: doc.chapters[0], units: [], isChapterOpener: false }];
  const seenChapter = new Set();
  packed.forEach((p) => {
    const isOpener = !seenChapter.has(p.chapter.id);
    seenChapter.add(p.chapter.id);
    pages.push({
      number: pages.length + 1,
      kind: isOpener ? 'opener' : 'content',
      chapter: p.chapter,
      units: p.units,
      isChapterOpener: isOpener,
      weight: p.weight,
    });
  });

  const used = new Set();
  pages.forEach((page, i) => {
    let concept = null;
    if (page.kind === 'cover') {
      concept = COVER();
    } else {
      for (const [key, build] of LIBRARY) {
        if (used.has(key)) continue;
        // library keys carry an optional |chapter:N disambiguator
        const [rawKey, chapterHint] = key.split('|chapter:');
        if (chapterHint && page.chapter.index !== Number(chapterHint)) continue;
        if (matches(rawKey, page)) { concept = build(); used.add(key); break; }
      }
      if (!concept) { concept = heuristicConcept(page, i); page.fallback = true; }
    }

    const sectionTitles = page.units.map((u) => u.section.title).filter(Boolean);
    page.concept = concept;
    page.caption = voiceCaption(concept.caption, dir, page);
    page.alt = `${concept.caption} — איור ${page.number} מתוך ${TARGET_PAGES}`;
    page.prompt = `${concept.prompt} ${stylePrompt(dir)}`;
    page.svg = renderArt(concept.archetype, { ...concept.config, alt: page.alt, seed: `p${page.number}` },
      page.kind === 'cover' ? { w: 900, h: 880 } : { w: 900, h: 520 });
    page.meta = {
      archetype: concept.archetype,
      chapter: page.chapter.title,
      sections: sectionTitles,
      kind: page.kind,
    };
  });

  // Human-presence pass: the reviewer can ask for more characters on the page.
  // Only pages that fell back to a heuristic concept are eligible — a curated
  // data illustration is never replaced by a talking head.
  const sceneCount = () => pages.filter((p2) => p2.concept.archetype === 'scene').length;
  const wanted = Math.round(dir.humanPresence * pages.length);
  if (sceneCount() < wanted) {
    const eligible = pages.filter(
      (p2) => p2.fallback && p2.concept.archetype !== 'scene' && p2.kind !== 'cover'
    );
    const moods = ['calm', 'happy', 'shock'];
    for (const page of eligible) {
      if (sceneCount() >= wanted) break;
      const title = page.units[0].section.title || page.chapter.title;
      const firstText = page.units.flatMap((u) => u.blocks).flatMap(blockTexts)[0] || '';
      page.concept = {
        archetype: 'scene',
        config: {
          say: firstText.replace(/^"|"$/g, '').slice(0, 38),
          tag: title.slice(0, 26),
          mood: moods[page.number % moods.length],
          color: [C.violet, C.teal, C.coral, C.gold][page.number % 4],
          prop: ['cart', 'laptop', 'suitcase', 'sneaker', 'phoneBroken'][page.number % 5],
        },
        caption: page.concept.caption,
        prompt: `Comic panel: a teenager reacting to the idea of "${title}", one short speech bubble, a single prop in frame, expressive but simple face marks.`,
      };
      page.caption = voiceCaption(page.concept.caption, dir, page);
      page.prompt = `${page.concept.prompt} ${stylePrompt(dir)}`;
      page.svg = renderArt(page.concept.archetype,
        { ...page.concept.config, alt: page.alt, seed: `p${page.number}` }, { w: 900, h: 520 });
      page.meta.archetype = 'scene';
    }
  }

  return { pages, artDirection: dir };
}

export function visualBrief(result, doc) {
  return {
    generatedFor: doc.title,
    artDirection: result.artDirection,
    styleSuffix: stylePrompt(result.artDirection),
    pageCount: result.pages.length,
    pages: result.pages.map((p) => ({
      page: p.number,
      chapter: p.meta.chapter,
      sections: p.meta.sections,
      archetype: p.meta.archetype,
      caption: p.caption,
      alt: p.alt,
      prompt: p.prompt,
    })),
  };
}
