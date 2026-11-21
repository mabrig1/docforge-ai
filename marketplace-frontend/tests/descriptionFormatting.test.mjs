import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDescriptionBlocks } from '../src/lib/descriptionFormatting.mjs';

test('keeps song verses and individual lyric lines distinct', () => {
  const input = [
    'Follow Your Dream', '',
    'OFFICIAL SONG LYRICS', '',
    '[Verse 1]', 'At the end', 'What matters', 'Is the dream you chase', '',
    '[Chorus]', 'Follow your dream', 'Follow your dream',
  ].join('\n');
  const blocks = formatDescriptionBlocks(input);
  assert.deepEqual(blocks.map(({kind}) => kind), [
    'paragraph', 'heading', 'verse', 'paragraph', 'verse', 'paragraph',
  ]);
  assert.equal(blocks[3].text, 'At the end\nWhat matters\nIs the dream you chase');
  assert.equal(blocks[5].text, 'Follow your dream\nFollow your dream');
});

test('preserves prose paragraphs without special markup', () => {
  const blocks = formatDescriptionBlocks('First paragraph.\r\n\r\nSecond paragraph.');
  assert.deepEqual(blocks, [
    {kind: 'paragraph', text: 'First paragraph.'},
    {kind: 'paragraph', text: 'Second paragraph.'},
  ]);
});

test('renders Markdown and plain-text section headings as blocks', () => {
  const blocks = formatDescriptionBlocks('## About the Song\nA song of faith.\n\n### [Bridge 1]\nKeep going.\n\nTHE MESSAGE BEHIND THE MUSIC');
  assert.deepEqual(blocks.map(b => b.kind), ['heading','paragraph','subheading','paragraph','heading']);
});

test('handles blank and malformed descriptions without throwing', () => {
  assert.deepEqual(formatDescriptionBlocks(null), []);
  assert.deepEqual(formatDescriptionBlocks('  \n  '), []);
  assert.deepEqual(formatDescriptionBlocks(123), []);
});

test('keeps untrusted HTML literal and never turns it into rendering instructions', () => {
  const input = '<img src=x onerror=alert(1)>\nSafe title';
  const blocks = formatDescriptionBlocks(input);
  assert.equal(blocks[0].kind, 'paragraph');
  assert.equal(blocks[0].text, input);
});

test('identifies dividers and emotional-bridge headings', () => {
  const blocks = formatDescriptionBlocks('---\n[Bridge 2 – Emotional Build]\nEvery tear you cried');
  assert.deepEqual(blocks.map(b => b.kind), ['divider','verse','paragraph']);
});
