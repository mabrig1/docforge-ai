const express = require('express');
const rateLimit = require('express-rate-limit');
const PasswordResetToken = require('../models/PasswordResetToken');
const {
  RESET_LIFETIME_MS, PUBLIC_RESPONSE, newResetToken, hashResetToken,
  isValidResetToken, recoveryEmailConfig, sendPasswordResetEmail,
} = require('../services/passwordRecovery');
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

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many recovery attempts. Please try again later.' },
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

    // Public signup must never grant administrator privileges by email alone.
    // Email ownership is not verified at this step.
    const user = await User.create({
      name,
      email: email.trim().toLowerCase(),
      passwordHash: password,
      role: 'buyer',
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
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +tokenVersion');
    const valid = user && (await user.comparePassword(password));
    if (!valid) {
      // Identical message for both "not found" and "wrong password" to prevent
      // user enumeration attacks
      return res.status(401).json({ error: 'Invalid email or password.' });
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

// ── POST /api/auth/forgot-password ─────────────────────────────────────────
// Always return the same public response, regardless of whether an account exists.
router.post('/forgot-password', resetLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    try { recoveryEmailConfig(); } catch {
      return res.status(503).json({ error: 'Account recovery is temporarily unavailable.' });
    }

    const user = await User.findOne({ email });
    if (user) {
      const recent = await PasswordResetToken.findOne({
        userId: user._id,
        createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) },
      });
      if (!recent) {
        await PasswordResetToken.deleteMany({ userId: user._id });
        const token = newResetToken();
        const record = await PasswordResetToken.create({
          userId: user._id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(Date.now() + RESET_LIFETIME_MS),
        });
        try {
          await sendPasswordResetEmail({ email: user.email, token });
        } catch (err) {
          await PasswordResetToken.deleteOne({ _id: record._id });
          console.error('[auth] recovery email failed:', err.message);
        }
      }
    }
    res.status(202).json({ message: PUBLIC_RESPONSE });
  } catch (err) { next(err); }
});

// ── POST /api/auth/reset-password ──────────────────────────────────────────
router.post('/reset-password', resetLimiter, async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!isValidResetToken(token) || typeof password !== 'string' || password.length < 12 || password.length > 128) {
      return res.status(400).json({ error: 'Invalid reset link or password. Use 12–128 characters.' });
    }
    // Atomic deletion makes the token single-use even under simultaneous requests.
    const record = await PasswordResetToken.findOneAndDelete({
      tokenHash: hashResetToken(token),
      expiresAt: { $gt: new Date() },
    });
    if (!record) return res.status(400).json({ error: 'Reset link is invalid or expired. Request another.' });
    const user = await User.findById(record.userId);
    if (!user) return res.status(400).json({ error: 'Reset link is invalid or expired. Request another.' });
    user.passwordHash = password; // User's pre-save hook hashes with bcrypt.
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate previously issued JWTs.
    // A confirmed mailbox challenge can safely restore the configured owner.
    // Never promote through public signup or password-only login.
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail && user.email === adminEmail) user.role = 'admin';
    await user.save();
    await PasswordResetToken.deleteMany({ userId: user._id });
    if (COOKIE_MODE) clearTokenCookie(res);
    res.json({ message: 'Password updated. Please log in with your new password.' });
  } catch (err) { next(err); }
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
