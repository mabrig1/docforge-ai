const crypto = require('crypto');

const RESET_LIFETIME_MS = 15 * 60 * 1000;
const PUBLIC_RESPONSE = 'If an account exists for that address, a recovery link will be sent.';

function newResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isValidResetToken(token) {
  return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
}

function recoveryEmailConfig() {
  const { RESEND_API_KEY, EMAIL_FROM, PASSWORD_RESET_BASE_URL } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !PASSWORD_RESET_BASE_URL) {
    throw new Error('Password recovery email is not configured.');
  }
  let base;
  try { base = new URL(PASSWORD_RESET_BASE_URL); } catch { throw new Error('Invalid password recovery URL.'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Password recovery URL must be a secure origin.');
  }
  return { RESEND_API_KEY, EMAIL_FROM, base };
}

async function sendPasswordResetEmail({ email, token }) {
  const config = recoveryEmailConfig();
  const url = new URL('/reset-password', config.base);
  url.searchParams.set('token', token);
  const resetUrl = url.toString();
  const text = `You requested a password reset for your DocForge Marketplace account.\n\nOpen this link within 15 minutes:\n${resetUrl}\n\nIf this wasn't you, ignore this email. Your password remains unchanged.`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.EMAIL_FROM,
      to: email,
      subject: 'Reset your DocForge Marketplace password',
      text,
      html: `<p>You requested a password reset for your DocForge Marketplace account.</p><p><a href="${resetUrl}">Reset your password</a> (expires in 15 minutes).</p><p>If this wasn't you, ignore this email.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Password recovery email delivery failed (HTTP ${res.status}).`);
}

module.exports = {
  RESET_LIFETIME_MS, PUBLIC_RESPONSE, newResetToken, hashResetToken,
  isValidResetToken, recoveryEmailConfig, sendPasswordResetEmail,
};
