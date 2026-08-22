/**
 * Acceptance checks for the built book. Runs with no dependencies:
 *   node src/verify.mjs
 * Exits non-zero on the first failed guarantee.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSource } from './lib/source.mjs';
import { sealSource, verifyBuild, ALLOWED_DIRECTIVE_KINDS } from './lib/integrity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => path.join(root, ...s);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const html = fs.readFileSync(p('dist/book.html'), 'utf8');
const brief = JSON.parse(fs.readFileSync(p('content/visual/visual-brief.json'), 'utf8'));
const rounds = JSON.parse(fs.readFileSync(p('reports/iterations.json'), 'utf8'));
const doc = parseSource(fs.readFileSync(p('content/source/book.he.md'), 'utf8'));
const seal = sealSource(doc);

const svgs = (html.match(/<svg /g) || []).length;
check('50 איורים בספר', svgs === 50, `${svgs}`);
check('50 עמודים', (html.match(/<section class="page/g) || []).length === 50);
check('50 כתוביות בבריף', brief.pages.length === 50 && brief.pages.every((x) => x.caption.length > 8));
check('50 פרומפטים בבריף', brief.pages.every((x) => x.prompt.length > 80));
check('לכל עמוד alt text', brief.pages.every((x) => x.alt && x.alt.length > 8));

const integrity = verifyBuild(seal, html);
check(`שלמות תוכן — ${seal.count} מקטעים verbatim`, integrity.ok,
  integrity.ok ? '' : `${integrity.missing.length} חסרים`);

const allDirectives = rounds.flatMap((r) => r.directives);
check('כל בקשות הביקורת בתחום עיצוב בלבד',
  allDirectives.every((d) => ALLOWED_DIRECTIVE_KINDS.has(d.kind)),
  `${allDirectives.length} בקשות`);

const last = rounds[rounds.length - 1];
check('אישור סופי מסוכן הביקורת', last.verdict === '100% מוכן לקריאה', last.verdict);
check('אין בקשות פתוחות בסבב האחרון', last.directives.length === 0);
check('זמן ריצה מתחת ל-120 דקות', last.elapsedMs < 2 * 60 * 60 * 1000,
  `${(last.elapsedMs / 1000).toFixed(1)} שניות`);
check('RTL + עברית', /direction:rtl/.test(html) && /lang="he"|Heebo/.test(html));
check('סגנון הדפסה', /@media print/.test(html));

console.log(failures ? `\n${failures} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failures ? 1 : 0);
