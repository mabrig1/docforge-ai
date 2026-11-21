# MABRIG Store administrator recovery

This change adds password recovery to the existing **MongoDB-backed marketplace**, not a separate user database.

## Deployment readiness

Do not deploy the frontend alone. Deploy the backend and configure the backend environment first:

- `ADMIN_EMAIL`: the existing administrator's verified mailbox (set privately; do not hard-code it in the public repository).
- `PASSWORD_RESET_BASE_URL=https://store.mabrigkorie.org/`: exact HTTPS frontend origin used in reset links.
- `RESEND_API_KEY`: working Resend API key in the backend's secret store.
- `EMAIL_FROM`: a sender address on a domain verified in Resend.
- Keep existing `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`, and payment secrets unchanged.

Confirm the store frontend at `https://store.mabrigkorie.org` points to the backend containing this change. The current `.env.example` also references an older domain, `creators.fintigen.com`; check all production deployment settings before enabling password recovery.

## Owner recovery

1. Open `https://store.mabrigkorie.org/forgot-password` **after both services are deployed**.
2. Enter the administrator's email address.
3. Open the reset link in that inbox within 15 minutes.
4. Set a new password of 12–128 characters; the token is consumed once and stored hashed only.
5. Visit `/login`, sign in, and verify that the user role is `admin` at `/admin`.

If the mailbox does not match an existing user, no new admin is automatically created. An existing user with the exact `ADMIN_EMAIL` is granted admin **only after proving control of the mailbox through the reset token**. Public signup and password-only login cannot grant admin merely by supplying the configured email.

## Security notes

- The response to reset requests does not reveal whether the account exists.
- Per-IP rate limiting (five requests per 15 minutes) and a per-account five-minute cooldown reduce spam.
- The raw reset token is never stored; MongoDB stores its SHA-256 hash, expiration, and user association.
- Successful reset increments `tokenVersion`, invalidating JWT sessions minted before the reset.
- The user's existing MongoDB document, purchase history, and role are preserved except where the verified `ADMIN_EMAIL` explicitly restores the admin role.
- The reset route does not reactivate a disabled user or bypass MongoDB authentication.
- If email delivery fails, the unused reset token is invalidated.
- Never send a reset password, reset token, or Resend key through chat, a commit, or an issue.

## Verification

From `marketplace/`:

```sh
npm install
npm test
```

Then stage-test with a non-admin account, a genuine recovery email, an expired/reused token, a previously issued JWT, and an administrator who owns the configured mailbox. Confirm the backend, frontend, and Resend sender are correctly configured; ensure no checkout or download route changes. Merge/deploy only after these checks pass.
