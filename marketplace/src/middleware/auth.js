const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Cookie name used when AUTH_MODE=cookie
const COOKIE_NAME = 'mkt_token';

/**
 * Dual-mode JWT extraction:
 *
 *  AUTH_MODE=bearer (default)
 *    Reads from Authorization: Bearer <token> header.
 *    Token is stored in localStorage on the client.
 *
 *  AUTH_MODE=cookie
 *    Reads from the httpOnly Secure SameSite=Strict cookie "mkt_token".
 *    Requires `cookie-parser` middleware mounted in server.js.
 *    Protects against XSS token theft (JS cannot access the cookie).
 *    Requires HTTPS in production (Secure flag).
 *
 * Switch by setting AUTH_MODE=cookie in your environment.
 */
function extractToken(req) {
  if (process.env.AUTH_MODE === 'cookie') {
    return req.cookies?.[COOKIE_NAME] ?? null;
  }
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Verifies the JWT (from header or cookie) and attaches req.user.
 */
async function protect(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const user = await User.findById(payload.sub).select('+isActive');
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Account not found or disabled.' });
  }

  req.user = user;
  next();
}

/**
 * Must be used AFTER `protect`.
 * Allows only users with role === 'admin'.
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

/**
 * Signs a JWT for the given user document.
 */
function signToken(user) {
  return jwt.sign(
    { sub: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Sets the JWT as an httpOnly cookie on the response.
 * Only called when AUTH_MODE=cookie.
 */
function setTokenCookie(res, token) {
  const maxAge = parseDurationToMs(process.env.JWT_EXPIRES_IN || '7d');
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
  });
}

/**
 * Clears the auth cookie (logout).
 */
function clearTokenCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parseDurationToMs(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return n * unit;
}

module.exports = { protect, requireAdmin, signToken, setTokenCookie, clearTokenCookie };
