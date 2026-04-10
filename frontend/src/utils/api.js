/**
 * API Client v2 — Backend communication with AbortController support.
 * All document endpoints require a JWT token (set via auth.js).
 */

import { authHeader, clearToken } from './auth.js';

// In production, VITE_API_BASE points to the Render backend URL.
// In dev, falls back to '' so the Vite proxy (/api → localhost:8000) works.
const BASE = (import.meta.env.VITE_API_BASE || '') + '/api';

async function request(path, body, signal) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) { clearToken(); window.location.reload(); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `Request failed: ${res.status}`);
  }
  return res;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function loginUser(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || 'Login failed.'); }
  return res.json();
}

export async function registerUser(email, name, password) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || 'Registration failed.'); }
  return res.json();
}

export async function getCurrentUser() {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeader() });
  if (!res.ok) return null;
  return res.json();
}

export async function getUsers() {
  const res = await fetch(`${BASE}/auth/users`, { headers: authHeader() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || 'Failed to load users.'); }
  return res.json();
}

export async function toggleUser(userId) {
  const res = await fetch(`${BASE}/auth/users/${userId}/toggle`, {
    method: 'PATCH',
    headers: authHeader(),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || 'Failed to update user.'); }
  return res.json();
}

export async function setPlan(userId, plan) {
  const res = await fetch(`${BASE}/auth/users/${userId}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || 'Failed to set plan.'); }
  return res.json();
}

// ── Document endpoints ───────────────────────────────────────────────────────

export async function parseInstruction(instruction, signal) {
  const res = await request('/parse-instruction', { instruction }, signal);
  return res.json();
}

export async function extractText(file, signal) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/extract-text`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
    signal,
  });
  if (res.status === 401) { clearToken(); window.location.reload(); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `Upload failed: ${res.status}`);
  }
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
