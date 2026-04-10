/**
 * Typed API client for the marketplace Express backend.
 *
 * All functions return the parsed JSON body on success and throw an Error
 * with a human-readable message on failure (4xx / 5xx / network error).
 *
 * Token storage: localStorage key "mkt_token".
 * The helpers getToken / setToken / clearToken are exported so components
 * and the Auth context can use them directly.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ── Token helpers ──────────────────────────────────────────────────────────
export const TOKEN_KEY = 'mkt_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────
async function request(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // Auto-logout on 401
  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export async function signup({ name, email, password }) {
  const data = await request('/api/auth/signup', {
    method: 'POST',
    body: { name, email, password },
    auth: false,
  });
  setToken(data.token);
  return data.user;
}

export async function login({ email, password }) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  setToken(data.token);
  return data.user;
}

export async function getMe() {
  const data = await request('/api/auth/me');
  return data.user;
}

// ── Products ───────────────────────────────────────────────────────────────
export async function listProducts(type) {
  const qs = type ? `?type=${type}` : '';
  const data = await request(`/api/products${qs}`, { auth: false });
  return data.products;
}

export async function getProduct(slug) {
  const data = await request(`/api/products/${slug}`, { auth: false });
  return data.product;
}

export async function createProduct(payload) {
  const data = await request('/api/products', { method: 'POST', body: payload });
  return data.product;
}

export async function updateProduct(id, payload) {
  const data = await request(`/api/products/${id}`, { method: 'PATCH', body: payload });
  return data.product;
}

export async function getUploadUrl(objectKey, contentType) {
  const data = await request('/api/products/upload-url', {
    method: 'POST',
    body: { objectKey, contentType },
  });
  return data; // { uploadUrl, objectKey }
}

// ── Orders ─────────────────────────────────────────────────────────────────
/**
 * Starts a Flutterwave checkout session.
 * Returns { paymentLink, txRef }.
 */
export async function initiateOrder(productId, currency = 'NGN') {
  return request('/api/orders/initiate', {
    method: 'POST',
    body: { productId, currency },
  });
}

export async function getMyOrders() {
  const data = await request('/api/orders/mine');
  return data.orders;
}

export async function getAllOrders() {
  const data = await request('/api/orders');
  return data.orders;
}

// ── Downloads ──────────────────────────────────────────────────────────────
/**
 * Returns { downloadUrl, expiresInSeconds, productTitle }.
 * The caller should immediately redirect the browser to downloadUrl.
 */
export async function getDownloadUrl(productId) {
  return request(`/api/download/${productId}`);
}
