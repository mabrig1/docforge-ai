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

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

// ── Token helpers ──────────────────────────────────────────────────────────
export const TOKEN_KEY   = 'mkt_token';
const SESSION_COOKIE     = 'mkt_session'; // lightweight edge-readable flag

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  // Also write a non-httpOnly cookie so Next.js middleware can read it at the
  // edge and redirect unauthenticated users before the page renders.
  // This cookie carries no sensitive data — it is only a routing signal.
  // The actual JWT validation always happens on the backend.
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax; max-age=${7 * 24 * 3600}${secure}`;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  // Expire the session indicator cookie immediately
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE}=; path=/; SameSite=Lax; max-age=0${secure}`;
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
 * Returns { paymentLink, txRef, provider: 'flutterwave' }.
 */
export async function initiateFlutterwaveOrder(productId, currency = 'NGN') {
  return request('/api/orders/initiate/flutterwave', {
    method: 'POST',
    body: { productId, currency },
  });
}

/**
 * Starts a Paystack checkout session.
 * Returns { paymentLink, reference, provider: 'paystack' }.
 * Supported currencies: NGN, USD, GBP (not EUR).
 */
export async function initiatePaystackOrder(productId, currency = 'NGN') {
  return request('/api/orders/initiate/paystack', {
    method: 'POST',
    body: { productId, currency },
  });
}

/**
 * Starts a PayPal checkout session.
 * Returns { paymentLink, paypalOrderId, provider: 'paypal' }.
 * Supported currencies: USD, GBP, EUR.
 */
export async function initiatePaypalOrder(productId, currency = 'USD') {
  return request('/api/orders/initiate/paypal', {
    method: 'POST',
    body: { productId, currency },
  });
}

/**
 * Captures a PayPal order after user approval.
 * Called from the payment callback page with the token param PayPal appends.
 */
export async function capturePaypalOrder(paypalOrderId) {
  return request(`/api/orders/paypal/capture/${paypalOrderId}`, {
    method: 'POST',
    body: {},
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

// ── Admin ──────────────────────────────────────────────────────────────────
export async function getAdminStats() {
  return request('/api/admin/stats');
}

export async function listAdminProducts() {
  const data = await request('/api/admin/products');
  return data.products;
}

export async function getAdminUsers(page = 1) {
  return request(`/api/admin/users?page=${page}`);
}

export async function toggleUser(id) {
  const data = await request(`/api/admin/users/${id}/toggle`, { method: 'PATCH' });
  return data.user;
}

// ── Downloads ──────────────────────────────────────────────────────────────
/**
 * Returns { downloadUrl, expiresInSeconds, productTitle }.
 * The caller should immediately redirect the browser to downloadUrl.
 */
export async function getDownloadUrl(productId) {
  return request(`/api/download/${productId}`);
}

/**
 * Returns a short-lived public download URL for an administrator-designated
 * free product. No account or payment is required.
 */
export async function getFreeDownloadUrl(productId) {
  return request(`/api/download/free/${productId}`, { auth: false });
}
