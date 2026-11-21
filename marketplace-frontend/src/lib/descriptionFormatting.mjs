/**
 * Convert a product's plain-text or lightly Markdown-formatted description
 * into safe, readable display blocks. This is a formatter, not an HTML parser.
 * React escapes all text; no raw HTML is ever interpreted.
 */
const HEADING_PATTERN = /^(#{1,4})\s+(.+)$/;
const SONG_SECTION_PATTERN = /^\[(?:verse(?:\s+\d+)?(?:\s*\/\s*outro)?|chorus(?:\s+\d+)?|bridge(?:\s+\d+)?(?:\s*[–—-]\s*[^\]]+)?|pre-chorus|outro|intro|hook|refrain)(?:[^\]]*)\]$/i;
const SECTION_LABEL_PATTERN = /^(?:about the song|official song lyrics|the message behind the music|about this release|lyrics|tracklist|track listing)$/i;

export function formatDescriptionBlocks(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const normalized = value.replace(/\r\n?/g, '\n').replace(/\u2028|\u2029/g, '\n');
  const lines = normalized.split('\n');
  const blocks = [];
  let paragraph = [];

  function finishParagraph() {
    if (!paragraph.length) return;
    const body = paragraph.join('\n').trim();
    if (body) blocks.push({ kind: 'paragraph', text: body });
    paragraph = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { finishParagraph(); continue; }
    if (/^(?:---+|\*\*\*+|___+)$/.test(line)) {
      finishParagraph();
      blocks.push({ kind: 'divider' });
      continue;
    }
    const markdownHeading = line.match(HEADING_PATTERN);
    if (markdownHeading) {
      finishParagraph();
      blocks.push({ kind: markdownHeading[1].length <= 2 ? 'heading' : 'subheading', text: markdownHeading[2].trim() });
      continue;
    }
    if (SONG_SECTION_PATTERN.test(line)) {
      finishParagraph();
      blocks.push({ kind: 'verse', text: line });
      continue;
    }
    if (SECTION_LABEL_PATTERN.test(line)) {
      finishParagraph();
      blocks.push({ kind: 'heading', text: line });
      continue;
    }
    paragraph.push(rawLine.trimEnd());
  }
  finishParagraph();
  return blocks;
}
