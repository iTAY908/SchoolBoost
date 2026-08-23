/**
 * THE LOOP.
 *
 * Visual → Editor → Teen Reviewer, repeating until the reviewer signs off with
 * "100% מוכן לקריאה", or the 2-hour budget runs out — whichever comes first.
 *
 * Hard guarantees enforced every single round:
 *   - exactly 50 pages, each with its own illustration + caption
 *   - every text fragment of the source present verbatim in the build
 *   - the reviewer may only issue presentation-level directives
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSource, docStats } from './lib/source.mjs';
import { sealSource, verifyBuild } from './lib/integrity.mjs';
import { runVisual, visualBrief, baseArtDirection, TARGET_PAGES } from './agents/visual.mjs';
import { runEditor, baseLayout } from './agents/editor.mjs';
import { runReviewer, applyDirectives } from './agents/reviewer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => path.join(root, ...s);

const BUDGET_MS = 2 * 60 * 60 * 1000; // the brief: two hours, hard stop
const MAX_ROUNDS = 12;

const log = [];
const say = (agent, msg) => {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${agent.padEnd(16)} ${msg}`;
  log.push(line);
  console.log(line);
};

function main() {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  const left = () => BUDGET_MS - elapsed();

  const raw = fs.readFileSync(p('content/source/book.he.md'), 'utf8');
  const doc = parseSource(raw);
  const seal = sealSource(doc);
  const stats = docStats(doc);

  say('ORCHESTRATOR', `מקור נטען: ${stats.chapters} פרקים, ${stats.blocks} בלוקים, ${stats.words} מילים.`);
  say('ORCHESTRATOR', `חותם תוכן: ${seal.digest.slice(0, 16)} (${seal.count} מקטעי טקסט נעולים).`);
  say('ORCHESTRATOR', `תקציב זמן: 120 דקות. יעד: אישור סופי מסוכן הביקורת.`);

  let layout = { ...baseLayout };
  let artDirection = { ...baseArtDirection };
  const rounds = [];
  let final = null;

  for (let i = 1; i <= MAX_ROUNDS; i++) {
    if (left() <= 0) { say('ORCHESTRATOR', 'תקציב הזמן נגמר — עוצר.'); break; }

    say('AGENT-VISUAL', `סבב ${i}: מתכנן storyboard ל-${TARGET_PAGES} עמודים (אנרגיה: ${artDirection.energy}, כתוביות: ${artDirection.captionVoice}).`);
    const visual = runVisual(doc, artDirection);

    if (visual.pages.length !== TARGET_PAGES) {
      throw new Error(`Storyboard produced ${visual.pages.length} pages, expected ${TARGET_PAGES}`);
    }
    const missingCaption = visual.pages.filter((pg) => !pg.caption || !pg.prompt);
    if (missingCaption.length) throw new Error(`${missingCaption.length} pages without caption/prompt`);
    say('AGENT-VISUAL', `הופקו ${visual.pages.length} איורים + ${visual.pages.length} כתוביות + ${visual.pages.length} פרומפטים.`);

    say('AGENT-EDITOR', `סבב ${i}: מרכיב את הספר (סקאלה ${layout.scale}, מידה ${layout.measure}ch, צפיפות ${layout.density}).`);
    const built = runEditor(doc, visual, layout);

    const check = verifyBuild(seal, built.html);
    if (!check.ok) {
      throw new Error(
        `IRON RULE VIOLATION — ${check.missing.length} source fragments missing from the build:\n` +
          check.missing.slice(0, 5).join('\n')
      );
    }
    say('AGENT-EDITOR', `בדיקת שלמות תוכן: ${check.checked}/${check.checked} מקטעים נמצאו verbatim. ✔`);

    const review = runReviewer({
      html: built.html,
      visual,
      editorStats: built.stats,
      layout,
      artDirection,
      iteration: i,
    });

    say('AGENT-TEEN',
      `ציונים — מעניין ${review.scores.interesting} | נראה טוב ${review.scores.looks} | שווה 20 ₪ ${review.scores.value} → כולל ${review.scores.overall}`);
    say('AGENT-TEEN', `"${review.verdict}"`);
    for (const d of review.directives) say('AGENT-TEEN', `  ↳ [${d.kind}] ${d.ask}`);

    rounds.push({
      iteration: i,
      layout: { ...layout },
      artDirection: { ...artDirection },
      scores: review.scores,
      verdict: review.verdict,
      directives: review.directives,
      dimensions: Object.fromEntries(
        Object.entries(review.dimensions).map(([k, v]) => [k, { score: v.score, notes: v.notes }])
      ),
      integrity: { checked: check.checked, ok: check.ok },
      elapsedMs: elapsed(),
    });

    final = { visual, built, review };

    if (review.approved) {
      say('AGENT-TEEN', `אישור סופי: "${review.approvalPhrase}"`);
      break;
    }

    const next = applyDirectives(review, layout, artDirection);
    layout = next.layout;
    artDirection = next.artDirection;
    say('ORCHESTRATOR', `הועברו ${review.directives.length} הנחיות לסוכן העיצוב. ממשיך לסבב ${i + 1}. (נותרו ${Math.round(left() / 60000)} דק׳)`);
  }

  if (!final) throw new Error('Loop produced no build');

  /* ── artifacts ─────────────────────────────────────────────────────── */

  fs.mkdirSync(p('dist'), { recursive: true });
  fs.mkdirSync(p('reports'), { recursive: true });
  fs.mkdirSync(p('content/visual'), { recursive: true });

  fs.writeFileSync(p('dist/book.html'), final.built.standalone);
  fs.writeFileSync(p('dist/book.artifact.html'), final.built.html);

  const brief = visualBrief(final.visual, doc);
  fs.writeFileSync(p('content/visual/visual-brief.json'), JSON.stringify(brief, null, 2));
  fs.writeFileSync(p('content/visual/visual-brief.md'), briefMarkdown(brief));

  fs.writeFileSync(p('reports/loop-log.txt'), log.join('\n') + '\n');
  fs.writeFileSync(p('reports/iterations.json'), JSON.stringify(rounds, null, 2));
  fs.writeFileSync(p('reports/review-final.md'), finalReport(rounds, final, elapsed(), seal, stats));

  const minutes = (elapsed() / 60000).toFixed(2);
  say('ORCHESTRATOR', `סיום. ${rounds.length} סבבים, ${minutes} דקות מתוך 120. סטטוס: ${final.review.approved ? 'מאושר' : 'לא אושר — נעצר בתקציב זמן'}`);
  fs.writeFileSync(p('reports/loop-log.txt'), log.join('\n') + '\n');

  if (!final.review.approved) process.exitCode = 1;
}

/* ── report writers ──────────────────────────────────────────────────── */

function briefMarkdown(brief) {
  const lines = [
    `# בריף ויזואלי — ${brief.pageCount} איורים`,
    '',
    `נוצר עבור: **${brief.generatedFor}**`,
    '',
    '## כיוון אמנותי',
    '',
    '```',
    brief.styleSuffix,
    '```',
    '',
    `פרמטרים: אנרגיה \`${brief.artDirection.energy}\` · ניגודיות \`${brief.artDirection.contrast}\` · קול הכתוביות \`${brief.artDirection.captionVoice}\``,
    '',
    '## העמודים',
    '',
  ];
  for (const pg of brief.pages) {
    lines.push(`### עמוד ${pg.page} — ${pg.chapter}`);
    lines.push('');
    lines.push(`**כתובית:** ${pg.caption}`);
    lines.push('');
    lines.push(`**ארכיטיפ:** \`${pg.archetype}\`${pg.sections.length ? ` · סעיפים: ${pg.sections.join(' · ')}` : ''}`);
    lines.push('');
    lines.push(`**Prompt:**`);
    lines.push('');
    lines.push('> ' + pg.prompt);
    lines.push('');
    lines.push(`**Alt:** ${pg.alt}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

function finalReport(rounds, final, elapsedMs, seal, stats) {
  const last = rounds[rounds.length - 1];
  const t = (n) => (n >= 88 ? '🟢' : n >= 78 ? '🟡' : '🔴');
  const lines = [
    '# דוח סוכן ביקורת הנוער — סיכום סופי',
    '',
    `**סטטוס:** ${final.review.approved ? `✅ ${final.review.approvalPhrase}` : '⛔ לא אושר'}`,
    '',
    `**סבבים:** ${rounds.length} · **זמן ריצה:** ${(elapsedMs / 60000).toFixed(2)} דקות מתוך 120 · **חותם תוכן:** \`${seal.digest.slice(0, 16)}\``,
    '',
    '## התקדמות הציונים',
    '',
    '| סבב | מעניין? | נראה טוב? | שווה 20 ₪? | כולל | פסק דין |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rounds.map(
      (r) =>
        `| ${r.iteration} | ${t(r.scores.interesting)} ${r.scores.interesting} | ${t(r.scores.looks)} ${r.scores.looks} | ${t(r.scores.value)} ${r.scores.value} | **${r.scores.overall}** | ${r.verdict} |`
    ),
    '',
    '## מה הסוכן ביקש, סבב אחרי סבב',
    '',
  ];
  for (const r of rounds) {
    if (!r.directives.length) {
      lines.push(`### סבב ${r.iteration}`, '', 'אין בקשות נוספות — אושר.', '');
      continue;
    }
    lines.push(`### סבב ${r.iteration}`, '');
    for (const d of r.directives) lines.push(`- \`${d.kind}\` — ${d.ask}`);
    lines.push('');
  }
  lines.push(
    '## חוק הברזל',
    '',
    `כל בקשה של סוכן הביקורת סווגה כ-\`style\` / \`layout\` / \`framing\` / \`visual\` בלבד.`,
    `אף בקשה לשינוי תוכן לא התקבלה, ובכל סבב אומתו ${seal.count} מקטעי טקסט מול המקור —`,
    `כולם נמצאו verbatim בספר הבנוי (${stats.words} מילים, ${stats.blocks} בלוקים).`,
    '',
    '## הערות הסוכן בסבב האחרון',
    ''
  );
  for (const [dim, data] of Object.entries(last.dimensions)) {
    lines.push(`**${dim}** — ${data.score}`);
    lines.push('');
    if (!data.notes.length) lines.push('- אין הערות.');
    for (const n of data.notes) lines.push(`- ${n}`);
    lines.push('');
  }
  return lines.join('\n');
}

main();
