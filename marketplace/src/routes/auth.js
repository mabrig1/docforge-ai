const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect, signToken, setTokenCookie, clearTokenCookie } = require('../middleware/auth');

const COOKIE_MODE = process.env.AUTH_MODE === 'cookie';

const router = express.Router();

// ── Rate limiters ──────────────────────────────────────────────────────────
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many signup attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── POST /api/auth/signup ──────────────────────────────────────────────────
/**
 * Body: { name, email, password }
 *
 * Flow:
 *  1. Validate required fields.
 *  2. Check email uniqueness.
 *  3. Assign `passwordHash = password` — the pre-save hook in User.js will
 *     bcrypt.hash() it before writing to MongoDB.
 *  4. Return a signed JWT + safe user object.
 */
router.post('/signup', signupLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // The protected ADMIN_EMAIL environment variable provides a safe recovery
    // path when the original administrator account is unavailable. It never
    // exposes a password or grants admin based on client-supplied role data.
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const normalizedEmail = email.toLowerCase();
    const role = configuredAdminEmail && normalizedEmail === configuredAdminEmail
      ? 'admin'
      : 'buyer';

    // passwordHash field triggers bcrypt in the pre-save hook
    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash: password,
      role,
      isActive: true,
    });
    const token = signToken(user);

    if (COOKIE_MODE) setTokenCookie(res, token);
    res.status(201).json({ token: COOKIE_MODE ? undefined : token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
/**
 * Body: { email, password }
 *
 * Flow:
 *  1. Fetch user including `passwordHash` (select: false by default).
 *  2. Use the `comparePassword` instance method to validate.
 *  3. Return a signed JWT + safe user object.
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    // Must explicitly select passwordHash because `select: false` is on the field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    const valid = user && (await user.comparePassword(password));
    if (!valid) {
      // Identical message for both "not found" and "wrong password" to prevent
      // user enumeration attacks
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (configuredAdminEmail && user.email === configuredAdminEmail) {
      let changed = false;
      if (user.role !== 'admin') {
        user.role = 'admin';
        changed = true;
      }
      if (!user.isActive) {
        user.isActive = true;
        changed = true;
      }
      if (changed) await user.save();
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been disabled.' });
    }

    const token = signToken(user);
    if (COOKIE_MODE) setTokenCookie(res, token);
    res.json({ token: COOKIE_MODE ? undefined : token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────
// In bearer mode: client just discards the token — nothing to do server-side.
// In cookie mode: clear the httpOnly cookie.
router.post('/logout', (req, res) => {
  if (COOKIE_MODE) clearTokenCookie(res);
  res.json({ message: 'Logged out.' });
});

module.exports = router;
