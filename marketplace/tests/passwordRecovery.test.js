const test = require('node:test');
const assert = require('node:assert/strict');
const {
  newResetToken, hashResetToken, isValidResetToken,
  RESET_LIFETIME_MS, recoveryEmailConfig, PUBLIC_RESPONSE,
} = require('../src/services/passwordRecovery');

test('recovery tokens are random 256-bit hex values', () => {
  const first = newResetToken();
  const second = newResetToken();
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, second);
  assert.equal(isValidResetToken(first), true);
  assert.equal(isValidResetToken('not-a-token'), false);
});

test('only a token hash is stored', () => {
  const token = newResetToken();
  assert.equal(hashResetToken(token).length, 64);
  assert.notEqual(hashResetToken(token), token);
  assert.equal(hashResetToken(token), hashResetToken(token));
});

test('recovery links expire after 15 minutes and public responses avoid account enumeration', () => {
  assert.equal(RESET_LIFETIME_MS, 900000);
  assert.match(PUBLIC_RESPONSE, /If an account exists/);
});

test('recovery requires a configured HTTPS-only frontend origin', () => {
  const saved = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    PASSWORD_RESET_BASE_URL: process.env.PASSWORD_RESET_BASE_URL,
  };
  try {
    process.env.RESEND_API_KEY = 'test_only';
    process.env.EMAIL_FROM = 'verified@example.com';
    for (const value of [
      'http://store.mabrigkorie.org/',
      'https://store.mabrigkorie.org/other-path',
      'https://user:secret@store.mabrigkorie.org/',
      'not-an-origin',
    ]) {
      process.env.PASSWORD_RESET_BASE_URL = value;
      assert.throws(() => recoveryEmailConfig());
    }
    process.env.PASSWORD_RESET_BASE_URL = 'https://store.mabrigkorie.org/';
    assert.equal(recoveryEmailConfig().base.origin, 'https://store.mabrigkorie.org');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
