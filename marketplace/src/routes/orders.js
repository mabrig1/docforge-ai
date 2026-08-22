/**
 * Order / Payment Routes
 * ──────────────────────
 * Two payment providers are supported: Flutterwave and Paystack.
 *
 * Shared flow:
 *  1. POST /api/orders/initiate/flutterwave  — returns Flutterwave hosted link
 *     POST /api/orders/initiate/paystack     — returns Paystack authorization_url
 *  2. Buyer completes payment on the provider's hosted page.
 *  3. Provider fires webhook to:
 *       POST /api/orders/webhook/flutterwave
 *       POST /api/orders/webhook/paystack
 *     Server verifies signature, re-verifies transaction via provider API,
 *     creates Order idempotently, sends receipt email.
 *  4. Provider redirects browser to /payment/callback?provider=<name>&...
 *  5. Callback page polls GET /api/orders/mine until the order appears.
 */

const crypto    = require('crypto');
const express   = require('express');
const mongoose  = require('mongoose');
const Order     = require('../models/Order');
const Product   = require('../models/Product');
const User      = require('../models/User');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const { protect, requireAdmin } = require('../middleware/auth');
const { sendPurchaseReceipt }   = require('../services/email');

const router = express.Router();

function recordPurchaseAttempt({ userId, productId, provider, currency }) {
  AnalyticsEvent.create({
    type: 'purchase_attempt',
    visitorId: `user:${userId}`,
    product: productId,
    provider,
    currency: currency.toUpperCase(),
  }).catch((err) => console.warn('Purchase attempt analytics skipped:', err.message));
}

/**
 * Constant-time string comparison to prevent timing-based signature forgery.
 * Returns false if lengths differ (avoids timingSafeEqual length-mismatch throw).
 */
function timingSafeCompare(a, b) {
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Returns true only when s is a valid 24-hex-char MongoDB ObjectId. */
function isValidObjectId(s) {
  return typeof s === 'string' && mongoose.Types.ObjectId.isValid(s);
}

// ── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Look up a product, validate it's published, check the buyer doesn't already
 * own it, and return { product, amount }.
 */
async function validatePurchase(productId, currency, userId) {
  const product = await Product.findById(productId);
  if (!product || !product.isPublished) {
    const err = new Error('Product not found.'); err.status = 404; throw err;
  }

  const amount = product.pricing[currency.toLowerCase()];
  if (!amount) {
    const err = new Error(`This product is not priced in ${currency}.`); err.status = 400; throw err;
  }

  const existing = await Order.findOne({ buyer: userId, product: productId, status: 'completed' });
  if (existing) {
    const err = new Error('You already own this product.'); err.status = 409; throw err;
  }

  return { product, amount };
}

/**
 * Idempotent order creation + post-purchase side effects.
 * Both webhook handlers call this after their own verification steps.
 */
async function fulfillOrder({ provider, txRef, gatewayTxId, buyerId, productId,
                               amountCharged, currency, expectedAmount, product }) {
  const matchKey = provider === 'paystack' ? 'paystackReference'
                 : provider === 'paypal'   ? 'paypalOrderId'
                 : 'flutterwaveTxRef';
  const txIdKey  = provider === 'paystack' ? 'paystackTransactionId'
                 : provider === 'paypal'   ? 'paypalCaptureId'
                 : 'flutterwaveTransactionId';

  const inserted = await Order.findOneAndUpdate(
    { [matchKey]: txRef },
    {
      $setOnInsert: {
        provider,
        buyer:          buyerId,
        product:        productId,
        [matchKey]:     txRef,
        [txIdKey]:      String(gatewayTxId),
        amountCharged,
        currency,
        priceAtPurchase: expectedAmount,
        status:         'completed',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Only run side effects on first insertion (not duplicate webhook replays)
  if (inserted.createdAt.getTime() > Date.now() - 5000) {
    Product.findByIdAndUpdate(productId, { $inc: { salesCount: 1 } }).exec();

    User.findById(buyerId).then((buyer) => {
      if (!buyer) return;
      const frontendUrl = process.env.FRONTEND_URL || 'https://creators.fintigen.com';
      sendPurchaseReceipt({
        buyerName:     buyer.name,
        buyerEmail:    buyer.email,
        productTitle:  product.title,
        productType:   product.productType,
        amountCharged,
        currency,
        txRef,
        dashboardUrl:  `${frontendUrl}/dashboard`,
      }).catch((e) => console.error(`[${provider} webhook] receipt email failed:`, e.message));
    }).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FLUTTERWAVE
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /api/orders/initiate/flutterwave ─────────────────────────────────
router.post('/initiate/flutterwave', protect, async (req, res, next) => {
  try {
    const { productId, currency = 'NGN' } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required.' });
    if (!isValidObjectId(productId)) return res.status(400).json({ error: 'Invalid productId.' });

    const { product, amount } = await validatePurchase(productId, currency, req.user._id);
    recordPurchaseAttempt({
      userId: req.user._id,
      productId: product._id,
      provider: 'flutterwave',
      currency,
    });

    const txRef    = `DF-FLW-${req.user._id}-${productId}-${Date.now()}`;
    const frontend = process.env.FRONTEND_URL || 'https://creators.fintigen.com';

    const payload = {
      tx_ref:          txRef,
      amount,
      currency:        currency.toUpperCase(),
      payment_options: 'card,ussd,banktransfer',
      customer:        { email: req.user.email, name: req.user.name },
      customizations:  {
        title:       'DocForge Marketplace',
        description: `Purchase: ${product.title}`,
        logo:        `${frontend}/logo.png`,
      },
      meta:         { productId: product._id.toString(), buyerId: req.user._id.toString() },
      redirect_url: `${frontend}/payment/callback?provider=flutterwave`,
    };

    const flwRes  = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const flwData = await flwRes.json();

    if (flwData.status !== 'success') {
      return res.status(502).json({ error: 'Flutterwave error. Please try again.' });
    }

    res.json({ paymentLink: flwData.data.link, txRef, provider: 'flutterwave' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── POST /api/orders/webhook/flutterwave ──────────────────────────────────
// Raw body is passed through by server.js — we parse it inline here.
router.post('/webhook/flutterwave', express.json(), async (req, res, next) => {
  try {
    // 1 — constant-time signature check (prevents timing attacks)
    const hash = req.headers['verif-hash'];
    if (!hash || !timingSafeCompare(hash, process.env.FLW_WEBHOOK_SECRET || '')) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const event = req.body;
    if (event.event !== 'charge.completed') return res.sendStatus(200);

    const { id: transactionId, tx_ref: txRef, status, meta } = event.data;
    if (status !== 'successful') return res.sendStatus(200);

    // 2 — re-verify with Flutterwave
    const verifyRes  = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );
    const { data: tx } = await verifyRes.json();

    if (!tx || tx.status !== 'successful' || tx.charge_response_code !== '00') {
      return res.sendStatus(200);
    }

    if (!isValidObjectId(meta?.productId) || !isValidObjectId(meta?.buyerId)) {
      console.warn(`[flutterwave webhook] Invalid ObjectId in meta txRef=${txRef}`);
      return res.sendStatus(200);
    }

    const product = await Product.findById(meta.productId);
    if (!product) return res.sendStatus(200);

    const expectedAmount = product.pricing[tx.currency.toLowerCase()];
    if (!expectedAmount || tx.amount < expectedAmount) {
      console.warn(`[flutterwave webhook] Amount mismatch txRef=${txRef}`);
      return res.sendStatus(200);
    }

    // 3 — fulfil
    await fulfillOrder({
      provider:       'flutterwave',
      txRef,
      gatewayTxId:    transactionId,
      buyerId:        meta.buyerId,
      productId:      meta.productId,
      amountCharged:  tx.amount,
      currency:       tx.currency,
      expectedAmount,
      product,
    });

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PAYSTACK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Paystack amounts are in the smallest currency unit:
 *   NGN → kobo  (× 100)   GBP → pence (× 100)   USD → cents (× 100)
 *
 * Supported currencies: NGN, USD, GBP
 * EUR is not supported by Paystack — the CheckoutSection filters it out.
 */
const PAYSTACK_CURRENCIES = new Set(['NGN', 'USD', 'GBP']);

// ── POST /api/orders/initiate/paystack ────────────────────────────────────
router.post('/initiate/paystack', protect, async (req, res, next) => {
  try {
    const { productId, currency = 'NGN' } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required.' });
    if (!isValidObjectId(productId)) return res.status(400).json({ error: 'Invalid productId.' });

    if (!PAYSTACK_CURRENCIES.has(currency.toUpperCase())) {
      return res.status(400).json({ error: `Paystack does not support ${currency}. Use NGN, USD, or GBP.` });
    }

    const { product, amount } = await validatePurchase(productId, currency, req.user._id);
    recordPurchaseAttempt({
      userId: req.user._id,
      productId: product._id,
      provider: 'paystack',
      currency,
    });

    // Paystack reference — must be unique per transaction
    const reference = `DF-PSK-${req.user._id}-${productId}-${Date.now()}`;
    const frontend  = process.env.FRONTEND_URL || 'https://creators.fintigen.com';

    // Paystack amounts are in subunits (kobo / cents / pence)
    const amountInSubunits = Math.round(amount * 100);

    const payload = {
      email:        req.user.email,
      amount:       amountInSubunits,
      currency:     currency.toUpperCase(),
      reference,
      callback_url: `${frontend}/payment/callback?provider=paystack`,
      metadata: {
        productId:    product._id.toString(),
        buyerId:      req.user._id.toString(),
        productTitle: product.title,
        custom_fields: [
          { display_name: 'Product',  variable_name: 'product_title', value: product.title },
          { display_name: 'Platform', variable_name: 'platform',      value: 'DocForge Marketplace' },
        ],
      },
    };

    const pskRes  = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const pskData = await pskRes.json();

    if (!pskData.status) {
      return res.status(502).json({ error: pskData.message || 'Paystack error. Please try again.' });
    }

    res.json({
      paymentLink: pskData.data.authorization_url,
      reference,
      provider: 'paystack',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── POST /api/orders/webhook/paystack ─────────────────────────────────────
/**
 * Paystack webhook security:
 *  - Header: x-paystack-signature = HMAC-SHA512(rawBody, PAYSTACK_SECRET_KEY)
 *  - We need the RAW body buffer to recompute the HMAC, so this route uses
 *    express.raw() instead of express.json(). The global JSON parser in
 *    server.js is bypassed for this path.
 *
 * After signature validation we re-verify the transaction via
 * GET https://api.paystack.co/transaction/verify/:reference
 * to prevent spoofed webhooks with inflated amounts.
 */
router.post('/webhook/paystack', express.raw({ type: '*/*' }), async (req, res, next) => {
  try {
    // 1 — HMAC-SHA512 signature verification
    const signature = req.headers['x-paystack-signature'];
    if (!signature) return res.status(401).json({ error: 'Missing Paystack signature.' });

    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(req.body)          // req.body is a Buffer here
      .digest('hex');

    if (!timingSafeCompare(signature, expected)) {
      return res.status(401).json({ error: 'Invalid Paystack signature.' });
    }

    // Parse the raw buffer now that authenticity is confirmed
    const event = JSON.parse(req.body.toString('utf8'));

    if (event.event !== 'charge.success') return res.sendStatus(200);

    const { reference } = event.data;

    // 2 — Re-verify with Paystack (amount & status double-check)
    const verifyRes  = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const { data: tx } = await verifyRes.json();

    if (!tx || tx.status !== 'success') return res.sendStatus(200);

    // Extract our metadata from the verified transaction
    const { productId, buyerId } = tx.metadata || {};
    if (!productId || !buyerId) {
      console.warn(`[paystack webhook] Missing metadata on reference=${reference}`);
      return res.sendStatus(200);
    }
    if (!isValidObjectId(productId) || !isValidObjectId(buyerId)) {
      console.warn(`[paystack webhook] Invalid ObjectId in metadata reference=${reference}`);
      return res.sendStatus(200);
    }

    const product = await Product.findById(productId);
    if (!product) return res.sendStatus(200);

    // Paystack returns amount in subunits — convert back to major units
    const amountMajor    = tx.amount / 100;
    const currency       = tx.currency.toUpperCase();
    const expectedAmount = product.pricing[currency.toLowerCase()];

    if (!expectedAmount || amountMajor < expectedAmount) {
      console.warn(`[paystack webhook] Amount mismatch reference=${reference}`);
      return res.sendStatus(200);
    }

    // 3 — Fulfil
    await fulfillOrder({
      provider:      'paystack',
      txRef:         reference,
      gatewayTxId:   tx.id,
      buyerId,
      productId,
      amountCharged: amountMajor,
      currency,
      expectedAmount,
      product,
    });

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PAYPAL
// ══════════════════════════════════════════════════════════════════════════════

const PAYPAL_CURRENCIES = new Set(['USD', 'GBP', 'EUR']);

function getPaypalBase() {
  return process.env.PAYPAL_ENV === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

async function getPaypalAccessToken() {
  const base = getPaypalBase();
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res  = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Could not authenticate with PayPal.');
  return data.access_token;
}

// ── POST /api/orders/initiate/paypal ─────────────────────────────────────
router.post('/initiate/paypal', protect, async (req, res, next) => {
  try {
    const { productId, currency = 'USD' } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required.' });
    if (!isValidObjectId(productId)) return res.status(400).json({ error: 'Invalid productId.' });

    if (!PAYPAL_CURRENCIES.has(currency.toUpperCase())) {
      return res.status(400).json({ error: `PayPal does not support ${currency}. Use USD, GBP, or EUR.` });
    }

    const { product, amount } = await validatePurchase(productId, currency, req.user._id);
    recordPurchaseAttempt({
      userId: req.user._id,
      productId: product._id,
      provider: 'paypal',
      currency,
    });

    const accessToken = await getPaypalAccessToken();
    const base        = getPaypalBase();
    const frontend    = process.env.FRONTEND_URL || 'https://creators.fintigen.com';

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: currency.toUpperCase(), value: amount.toFixed(2) },
        description: product.title,
        custom_id: JSON.stringify({
          productId: product._id.toString(),
          buyerId:   req.user._id.toString(),
        }),
      }],
      application_context: {
        brand_name:          'Mabrig Marketplace',
        shipping_preference: 'NO_SHIPPING',
        user_action:         'PAY_NOW',
        return_url: `${frontend}/payment/callback?provider=paypal`,
        cancel_url: `${frontend}/payment/callback?provider=paypal&status=cancelled`,
      },
    };

    const ppRes  = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const ppData = await ppRes.json();

    if (!ppData.id) {
      console.error('[paypal initiate] error:', ppData);
      return res.status(502).json({ error: 'PayPal error. Please try again.' });
    }

    const approveLink = ppData.links?.find((l) => l.rel === 'approve')?.href;
    if (!approveLink) return res.status(502).json({ error: 'PayPal approval link missing.' });

    res.json({ paymentLink: approveLink, paypalOrderId: ppData.id, provider: 'paypal' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── POST /api/orders/paypal/capture/:paypalOrderId ────────────────────────
router.post('/paypal/capture/:paypalOrderId', protect, async (req, res, next) => {
  try {
    const { paypalOrderId } = req.params;

    const accessToken = await getPaypalAccessToken();
    const base        = getPaypalBase();

    const captureRes  = await fetch(`${base}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const captureData = await captureRes.json();

    if (captureData.status !== 'COMPLETED') {
      console.warn('[paypal capture] not completed:', captureData.status);
      return res.status(400).json({ error: 'PayPal payment not completed.' });
    }

    const purchaseUnit = captureData.purchase_units?.[0];
    const capture      = purchaseUnit?.payments?.captures?.[0];
    if (!capture) return res.status(400).json({ error: 'PayPal capture data missing.' });

    let productId, buyerId;
    try {
      ({ productId, buyerId } = JSON.parse(purchaseUnit.custom_id || '{}'));
    } catch {
      return res.status(400).json({ error: 'Invalid PayPal order metadata.' });
    }

    if (!isValidObjectId(productId) || !isValidObjectId(buyerId)) {
      return res.status(400).json({ error: 'Invalid IDs in PayPal order metadata.' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const amountCharged  = parseFloat(capture.amount.value);
    const currency       = capture.amount.currency_code.toUpperCase();
    const expectedAmount = product.pricing[currency.toLowerCase()];

    if (!expectedAmount || amountCharged < expectedAmount * 0.99) {
      console.warn('[paypal capture] amount mismatch', { amountCharged, expectedAmount });
      return res.status(400).json({ error: 'Payment amount mismatch.' });
    }

    await fulfillOrder({
      provider:      'paypal',
      txRef:         paypalOrderId,
      gatewayTxId:   capture.id,
      buyerId,
      productId,
      amountCharged,
      currency,
      expectedAmount,
      product,
    });

    res.json({ success: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SHARED READ ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/orders/mine ──────────────────────────────────────────────────
router.get('/mine', protect, async (req, res, next) => {
  try {
    const orders = await Order.find({ buyer: req.user._id, status: 'completed' })
      .populate('product', 'title slug coverImageUrl productType')
      .sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/orders  (admin) ──────────────────────────────────────────────
router.get('/', protect, requireAdmin, async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('buyer',   'name email')
      .populate('product', 'title productType')
      .sort({ createdAt: -1 })
      .limit(500);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
