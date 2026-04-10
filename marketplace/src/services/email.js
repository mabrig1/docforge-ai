/**
 * Email Receipt Service — powered by Resend (https://resend.com)
 *
 * Resend is a simple HTTP API; no heavy SDK is required.
 * Add RESEND_API_KEY and EMAIL_FROM to your environment.
 *
 * If RESEND_API_KEY is absent (e.g. local dev without email),
 * all functions log to stdout and return gracefully — no crash.
 */

const RESEND_API = 'https://api.resend.com/emails';

/**
 * Low-level send helper. All other functions in this module call this.
 * @param {object} opts
 * @param {string}   opts.to          - Recipient email
 * @param {string}   opts.subject     - Email subject
 * @param {string}   opts.html        - HTML body
 * @param {string}   [opts.text]      - Plain-text fallback
 */
async function send({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.EMAIL_FROM || 'receipts@creators.fintigen.com';

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return;
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Log but don't throw — a failed email should never break the webhook response
    console.error(`[email] Resend error ${res.status}: ${body}`);
  }
}

// ── Templates ──────────────────────────────────────────────────────────────

/**
 * Send a purchase receipt to the buyer.
 *
 * @param {object} opts
 * @param {string} opts.buyerName
 * @param {string} opts.buyerEmail
 * @param {string} opts.productTitle
 * @param {string} opts.productType    — 'book' | 'audio'
 * @param {number} opts.amountCharged
 * @param {string} opts.currency
 * @param {string} opts.txRef
 * @param {string} opts.dashboardUrl   — full URL to buyer's library
 */
async function sendPurchaseReceipt({
  buyerName,
  buyerEmail,
  productTitle,
  productType,
  amountCharged,
  currency,
  txRef,
  dashboardUrl,
}) {
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amountCharged);

  const typeLabel = productType === 'audio' ? 'Music Album' : 'Digital Book';
  const icon      = productType === 'audio' ? '🎵' : '📖';

  const subject = `Your receipt for "${productTitle}" — DocForge Marketplace`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0a0a0a; color: #e5e7eb; margin: 0; padding: 0; }
    .wrapper { max-width: 520px; margin: 40px auto; padding: 0 16px; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 16px;
            padding: 32px; }
    .brand { font-size: 22px; font-weight: 800; color: #e879f9; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #f9fafb; margin: 0 0 8px; }
    .sub { color: #9ca3af; font-size: 14px; margin: 0 0 28px; }
    .product-row { display: flex; align-items: center; gap: 12px;
                   background: #1f2937; border-radius: 12px; padding: 16px;
                   margin-bottom: 24px; }
    .icon { font-size: 32px; line-height: 1; }
    .product-title { font-weight: 600; color: #f3f4f6; font-size: 16px; }
    .product-type  { color: #9ca3af; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 28px; }
    td { padding: 8px 0; border-bottom: 1px solid #1f2937; }
    td:last-child { text-align: right; color: #f3f4f6; font-weight: 500; }
    td:first-child { color: #9ca3af; }
    .total td { border-bottom: none; font-size: 16px; font-weight: 700; }
    .total td:last-child { color: #e879f9; }
    .btn { display: inline-block; background: #c026d3; color: #fff !important;
           text-decoration: none; font-weight: 600; font-size: 15px;
           padding: 12px 28px; border-radius: 10px; }
    .footer { margin-top: 28px; font-size: 12px; color: #4b5563; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="brand">DocForge Market</div>
      <h1>Purchase confirmed! ${icon}</h1>
      <p class="sub">Hi ${buyerName}, your payment was successful. Your download is ready.</p>

      <div class="product-row">
        <div class="icon">${icon}</div>
        <div>
          <div class="product-title">${productTitle}</div>
          <div class="product-type">${typeLabel}</div>
        </div>
      </div>

      <table>
        <tr>
          <td>Transaction ref</td>
          <td>${txRef}</td>
        </tr>
        <tr>
          <td>Currency</td>
          <td>${currency}</td>
        </tr>
        <tr class="total">
          <td>Amount charged</td>
          <td>${formattedAmount}</td>
        </tr>
      </table>

      <a href="${dashboardUrl}" class="btn">Go to My Library →</a>

      <div class="footer">
        You're receiving this because you purchased a product at creators.fintigen.com.<br />
        If you didn't make this purchase, contact us immediately.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
DocForge Marketplace — Purchase Receipt

Hi ${buyerName},

Your purchase of "${productTitle}" (${typeLabel}) was successful.

Amount: ${formattedAmount} ${currency}
Ref:    ${txRef}

Download your file here: ${dashboardUrl}

If you didn't make this purchase, contact support immediately.
  `.trim();

  await send({ to: buyerEmail, subject, html, text });
}

module.exports = { sendPurchaseReceipt };
