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

const crypto  = require('crypto');
const express = require('express');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const User    = require('../models/User');
const { protect, requireAdmin } = require('../middleware/auth');
const { sendPurchaseReceipt }   = require('../services/email');

const router = express.Router();

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
  const matchKey   = provider === 'paystack' ? 'paystackReference'       : 'flutterwaveTxRef';
  const txIdKey    = provider === 'paystack' ? 'paystackTransactionId'   : 'flutterwaveTransactionId';

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

    const { product, amount } = await validatePurchase(productId, currency, req.user._id);

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
    // 1 — signature check
    const hash = req.headers['verif-hash'];
    if (!hash || hash !== process.env.FLW_WEBHOOK_SECRET) {
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

    if (!PAYSTACK_CURRENCIES.has(currency.toUpperCase())) {
      return res.status(400).json({ error: `Paystack does not support ${currency}. Use NGN, USD, or GBP.` });
    }

    const { product, amount } = await validatePurchase(productId, currency, req.user._id);

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

    if (signature !== expected) {
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
