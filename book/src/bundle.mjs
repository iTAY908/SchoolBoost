/**
 * Bundles dist/book.html into dist/book-standalone.html with the webfonts
 * embedded, so the file needs no network at all — double-click it, mail it,
 * or drop it into an app as a single asset.
 *
 *   node src/bundle.mjs
 *
 * If the fonts cannot be fetched it still writes the file, keeping the
 * stylesheet link, and says so on stderr.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => path.join(root, ...s);

const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&family=Secular+One&display=swap';
// A woff2-capable desktop UA, so Google serves woff2 rather than ttf.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
// The book is Hebrew with a few Latin HUD labels; the other subsets are dead weight.
const KEEP = new Set(['hebrew', 'latin']);

async function fetchFontCss() {
  const res = await fetch(CSS_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`font stylesheet: HTTP ${res.status}`);
  return res.text();
}

/** Split the stylesheet into `/* subset *\/ @font-face {...}` units. */
function faces(css) {
  const out = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m;
  while ((m = re.exec(css))) out.push({ subset: m[1], block: m[2] });
  return out;
}

async function embed(block) {
  const url = block.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
  if (!url) return null;
  const res = await fetch(url[1], { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`font file: HTTP ${res.status}`);
  const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
  return {
    css: block.replace(url[0], `url(data:font/woff2;base64,${b64})`),
    bytes: b64.length,
  };
}

async function main() {
  const src = fs.readFileSync(p('dist/book.html'), 'utf8');
  const links =
    /<link rel="preconnect"[\s\S]*?<link href="https:\/\/fonts\.googleapis\.com[^>]*>/;
  if (!links.test(src)) {
    throw new Error('could not find the font links in dist/book.html');
  }

  let inlined = null;
  try {
    const wanted = faces(await fetchFontCss()).filter((f) => KEEP.has(f.subset));
    if (!wanted.length) throw new Error('no hebrew/latin subsets in the stylesheet');
    const parts = [];
    let bytes = 0;
    for (const f of wanted) {
      const got = await embed(f.block);
      if (got) parts.push(got.css), (bytes += got.bytes);
    }
    inlined = { css: parts.join('\n'), count: parts.length, bytes };
  } catch (err) {
    process.stderr.write(`אזהרה: הפונטים לא הוטמעו (${err.message}). הקובץ נשמר עם קישור לפונטים.\n`);
  }

  const html = inlined
    ? src.replace(links, `<style>\n${inlined.css}\n</style>`)
    : src;

  const out = p('dist/book-standalone.html');
  fs.writeFileSync(out, html);

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(
    `dist/book-standalone.html · ${kb(Buffer.byteLength(html))}` +
      (inlined ? ` · ${inlined.count} גופנים מוטמעים` : ' · ללא גופנים מוטמעים')
  );
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exitCode = 1;
});
