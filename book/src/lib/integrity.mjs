/**
 * IRON RULE ENFORCEMENT.
 *
 * The Teen Reviewer may ask for phrasing-frame, styling and layout changes.
 * It may never delete or rewrite the core script or the financial content.
 * Instead of trusting the agents to behave, the loop verifies it:
 *
 *  1. sealSource() fingerprints every text fragment in the source tree.
 *  2. verifyBuild() re-extracts the text from the rendered book and asserts
 *     that every sealed fragment is still present, verbatim.
 *  3. assertDirectives() rejects any reviewer directive outside the
 *     allow-list of presentation-only change types.
 */
import { createHash } from 'node:crypto';
import { allBlocks, blockTexts } from './source.mjs';

export const ALLOWED_DIRECTIVE_KINDS = new Set([
  'style',   // colors, type scale, spacing, decoration
  'layout',  // page structure, rhythm, ordering of visual furniture
  'framing', // added hooks/labels AROUND the text (never inside it)
  'visual',  // illustration density, art direction
]);

/* Two readings of the same build:
   - `loose` turns every tag into a space, so neighbouring blocks stay separate.
   - `tight` drops tags entirely, so inline emphasis inside a sentence
     (<b class="num">5,000 ₪</b>) does not break the sentence apart.
   A fragment counts as present if either reading contains it verbatim. */
const stripLoose = (html) => html.replace(/<[^>]*>/g, ' ');
const stripTight = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]*>/g, '');
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

export const normalize = (s) => decode(String(s)).replace(/\s+/g, ' ').trim();

export function sealSource(doc) {
  const fragments = [];
  for (const block of allBlocks(doc)) {
    for (const text of blockTexts(block)) {
      const n = normalize(text);
      if (n) fragments.push(n);
    }
  }
  const digest = createHash('sha256').update(fragments.join(' ')).digest('hex');
  return { fragments, digest, count: fragments.length };
}

export function verifyBuild(seal, html) {
  const loose = normalize(stripLoose(html));
  const tight = normalize(stripTight(html));
  const missing = [];
  for (const fragment of seal.fragments) {
    if (!loose.includes(fragment) && !tight.includes(fragment)) missing.push(fragment);
  }
  return { ok: missing.length === 0, missing, checked: seal.fragments.length };
}

export function assertDirectives(directives) {
  const illegal = directives.filter((d) => !ALLOWED_DIRECTIVE_KINDS.has(d.kind));
  if (illegal.length) {
    throw new Error(
      'IRON RULE VIOLATION - reviewer asked for content changes: ' +
        illegal.map((d) => `${d.kind}:${d.id}`).join(', ')
    );
  }
  return true;
}
