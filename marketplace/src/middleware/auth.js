const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verifies the Bearer token in the Authorization header.
 * Attaches the full User document to `req.user` on success.
 */
async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  const token = header.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
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
 * Signs and returns a JWT for the given user document.
 */
function signToken(user) {
  return jwt.sign(
    { sub: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { protect, requireAdmin, signToken };
