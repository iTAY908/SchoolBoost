/**
 * Source loader for the financial book.
 *
 * The parsed tree is the single source of truth for CONTENT. No agent in the
 * pipeline is allowed to rewrite it — see lib/integrity.mjs, which verifies
 * that every text block that enters here comes out verbatim in the built book.
 */

const MARKERS = new Set(['subtitle', 'note', 'rule', 'wallet', 'boss', 'day']);
const GROUP_MARKERS = new Set(['wallet', 'boss', 'day']);

function slug(prefix, n) {
  return `${prefix}-${String(n).padStart(2, '0')}`;
}

/** Split raw markdown into logical lines groups separated by blank lines. */
function chunk(lines) {
  const out = [];
  let buf = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (buf.length) out.push(buf), (buf = []);
    } else {
      buf.push(line);
    }
  }
  if (buf.length) out.push(buf);
  return out;
}

function parseBlockChunk(lines) {
  const first = lines[0];

  if (/^\|/.test(first)) {
    const rows = lines
      .filter((l) => /^\|/.test(l))
      .map((l) =>
        l
          .replace(/^\|/, '')
          .replace(/\|\s*$/, '')
          .split('|')
          .map((c) => c.trim())
      );
    return { type: 'table', head: rows[0], rows: rows.slice(1) };
  }

  if (lines.every((l) => /^- \[ \]/.test(l))) {
    return { type: 'checklist', items: lines.map((l) => l.replace(/^- \[ \]\s*/, '')) };
  }

  if (lines.every((l) => /^-\s+/.test(l))) {
    return { type: 'list', items: lines.map((l) => l.replace(/^-\s+/, '')) };
  }

  if (lines.every((l) => /^\d+\.\s+/.test(l))) {
    return { type: 'olist', items: lines.map((l) => l.replace(/^\d+\.\s+/, '')) };
  }

  if (lines.every((l) => /^>\s?/.test(l))) {
    return { type: 'quote', text: lines.map((l) => l.replace(/^>\s?/, '')).join(' ') };
  }

  return { type: 'p', text: lines.join(' ').trim() };
}

export function parseSource(raw) {
  const lines = raw.split('\n');
  const doc = { title: '', subtitle: '', chapters: [] };

  let chapter = null;
  let section = null;
  let pendingMarker = null;
  let group = null;
  let chapterCount = 0;

  const pushBlock = (block) => {
    if (!section) return;
    if (group && !GROUP_MARKERS.has(block._marker)) {
      group.blocks.push(block);
    } else {
      section.blocks.push(block);
    }
  };

  const openSection = (title) => {
    group = null;
    section = { id: '', title, blocks: [] };
    chapter.sections.push(section);
    section.id = `${chapter.id}-s${chapter.sections.length}`;
  };

  const buffer = [];
  const flush = () => {
    if (!buffer.length) return;
    const block = parseBlockChunk(buffer.splice(0));
    if (pendingMarker) {
      if (pendingMarker === 'subtitle') {
        doc.subtitle = block.text;
        pendingMarker = null;
        return;
      }
      if (GROUP_MARKERS.has(pendingMarker)) {
        group = {
          type: 'group',
          variant: pendingMarker,
          label: block.text,
          blocks: [],
          _marker: pendingMarker,
        };
        section.blocks.push(group);
        pendingMarker = null;
        return;
      }
      block.type = pendingMarker; // note | rule
      pendingMarker = null;
      // callouts always attach to the section, never inside a group card
      const target = group ? group.blocks : section.blocks;
      target.push(block);
      return;
    }
    pushBlock(block);
  };

  for (const line of lines) {
    const t = line.trim();

    if (t === '') {
      flush();
      continue;
    }

    if (t.startsWith('@@')) {
      flush();
      const name = t.slice(2).trim();
      if (MARKERS.has(name)) pendingMarker = name;
      continue;
    }

    if (t.startsWith('# ')) {
      flush();
      doc.title = t.slice(2).trim();
      continue;
    }

    if (t.startsWith('## ')) {
      flush();
      chapterCount += 1;
      const title = t.slice(3).trim();
      const m = title.match(/^פרק (\d+)/);
      chapter = {
        id: slug('ch', chapterCount),
        index: chapterCount,
        number: m ? Number(m[1]) : null,
        kind: m ? 'chapter' : 'special',
        title,
        sections: [],
      };
      doc.chapters.push(chapter);
      openSection(null); // lead-in section (text before the first ###)
      continue;
    }

    if (t.startsWith('### ')) {
      flush();
      openSection(t.slice(4).trim());
      continue;
    }

    buffer.push(t);
  }
  flush();

  // drop empty lead-in sections
  for (const ch of doc.chapters) ch.sections = ch.sections.filter((s) => s.blocks.length);

  return doc;
}

/** Every text fragment carried by a block, in reading order. */
export function blockTexts(block) {
  switch (block.type) {
    case 'p':
    case 'note':
    case 'rule':
    case 'quote':
      return [block.text];
    case 'list':
    case 'olist':
    case 'checklist':
      return block.items.slice();
    case 'table':
      return [...block.head, ...block.rows.flat()];
    case 'group':
      return [block.label, ...block.blocks.flatMap(blockTexts)];
    default:
      return [];
  }
}

export function allBlocks(doc) {
  return doc.chapters.flatMap((c) => c.sections.flatMap((s) => s.blocks));
}

export function docStats(doc) {
  const blocks = allBlocks(doc);
  const words = blocks
    .flatMap(blockTexts)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return {
    chapters: doc.chapters.length,
    sections: doc.chapters.reduce((n, c) => n + c.sections.length, 0),
    blocks: blocks.length,
    words,
  };
}
