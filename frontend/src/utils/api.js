/**
 * API Client v2 — Backend communication with AbortController support.
 */

const BASE = '/api';

async function request(path, body, signal) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `Request failed: ${res.status}`);
  }
  return res;
}

export async function parseInstruction(instruction, signal) {
  const res = await request('/parse-instruction', { instruction }, signal);
  return res.json();
}

export async function formatDocument(document, rules, signal) {
  const res = await request('/format-document', { document, rules }, signal);
  return res.json();
}

export async function generateCitations(document, style, signal) {
  const res = await request('/generate-citations', { document, style }, signal);
  return res.json();
}

export async function exportDocument(document, rules, format = 'docx', signal) {
  const res = await request('/export', { document, rules, format }, signal);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `formatted.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
