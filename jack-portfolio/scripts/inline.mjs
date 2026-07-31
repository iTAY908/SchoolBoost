/**
 * Folds the Vite build into one self-contained HTML file.
 *
 * Run after `vite build --base=./` (see the `build:single` npm script).
 * Output: jack-3d-creator.html — open it straight from disk, no server.
 *
 * The external images, GIFs and the Kanit webfont stay remote by design;
 * only the app's own CSS and JS are inlined.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const OUT = 'jack-3d-creator.html';

const assets = readdirSync(join(DIST, 'assets'));
const cssName = assets.find((f) => f.endsWith('.css'));
const jsName = assets.find((f) => f.endsWith('.js'));

if (!cssName || !jsName) {
  console.error(`inline: expected a .css and a .js in ${DIST}/assets — run the build first`);
  process.exit(1);
}

const css = readFileSync(join(DIST, 'assets', cssName), 'utf8');
const js = readFileSync(join(DIST, 'assets', jsName), 'utf8');

let html = readFileSync(join(DIST, 'index.html'), 'utf8');
const before = html;

// Replacements use a function so `$&`-style patterns inside bundled code
// are never interpreted as replacement tokens.
html = html.replace(
  new RegExp(`<link[^>]*href="\\./assets/${cssName}"[^>]*>`),
  () => `<style>\n${css}\n</style>`,
);
html = html.replace(
  new RegExp(`<script[^>]*src="\\./assets/${jsName}"[^>]*></script>`),
  () => `<script type="module">\n${js}\n</script>`,
);

// Check the original tags specifically. A blanket search for "assets/" would
// false-positive: the bundled JS contains motionsites.ai /assets/ GIF URLs.
const stillLinked =
  html.includes(`./assets/${cssName}`) || html.includes(`./assets/${jsName}`);

if (html === before || stillLinked) {
  console.error('inline: failed to replace the asset tags');
  process.exit(1);
}

writeFileSync(OUT, html);
console.log(`inline: wrote ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
