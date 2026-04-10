/**
 * Order / Payment Routes
 * ──────────────────────
 * Payment flow overview:
 *
 *  1. Client calls POST /api/orders/initiate with { productId, currency }.
 *     Server responds with the Flutterwave payment link.
 *
 *  2. User completes payment on Flutterwave's hosted page.
 *
 *  3. Flutterwave fires a POST /api/orders/webhook with the transaction
 *     details. The server:
 *       a. Verifies the webhook secret hash.
 *       b. Re-verifies the transaction with Flutterwave's Verify API
 *          (prevents forged webhooks accepting fake amounts).
 *       c. Creates an Order document only if amount matches the product price.
 *
 *  4. Client can poll GET /api/orders/mine to see confirmed purchases,
 *     then hit GET /api/download/:productId to get the signed URL.
 */

const crypto = require('crypto');
const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, requireAdmin } = require('../middleware/auth');
const { sendPurchaseReceipt } = require('../services/email');

const router = express.Router();

// ── POST /api/orders/initiate ─────────────────────────────────────────────
/**
 * Authenticated: start a Flutterwave checkout session.
 * Returns a payment link the frontend redirects the buyer to.
 */
router.post('/initiate', protect, async (req, res, next) => {
  try {
    const { productId, currency = 'NGN' } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required.' });

    const product = await Product.findById(productId);
    if (!product || !product.isPublished) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const currencyKey = currency.toLowerCase();
    const amount = product.pricing[currencyKey];
    if (!amount) {
      return res.status(400).json({
        error: `This product is not available in ${currency}.`,
      });
    }

    // Check if already purchased
    const existing = await Order.findOne({
      buyer: req.user._id,
      product: productId,
      status: 'completed',
    });
    if (existing) {
      return res.status(409).json({ error: 'You already own this product.' });
    }

    // Unique, idempotent transaction reference
    const txRef = `DF-${req.user._id}-${productId}-${Date.now()}`;

    // Build Flutterwave inline charge payload
    // See: https://developer.flutterwave.com/docs/collecting-payments/inline
    const payload = {
      tx_ref: txRef,
      amount,
      currency: currency.toUpperCase(),
      payment_options: 'card,ussd,banktransfer',
      customer: {
        email: req.user.email,
        name: req.user.name,
      },
      customizations: {
        title: 'DocForge Marketplace',
        description: `Purchase: ${product.title}`,
        logo: 'https://creators.fintigen.com/logo.png',
      },
      meta: {
        productId: product._id.toString(),
        buyerId: req.user._id.toString(),
      },
      redirect_url: `${process.env.FRONTEND_URL || 'https://creators.fintigen.com'}/payment/callback`,
    };

    // Call Flutterwave to create a hosted payment link
    const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const flwData = await flwRes.json();
    if (flwData.status !== 'success') {
      return res.status(502).json({ error: 'Payment gateway error. Please try again.' });
    }

    res.json({ paymentLink: flwData.data.link, txRef });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/orders/webhook ──────────────────────────────────────────────
/**
 * Called by Flutterwave after a payment is completed.
 * This route must be PUBLIC (no protect middleware).
 *
 * Security steps:
 *  1. Verify the `verif-hash` header matches our FLW_WEBHOOK_SECRET.
 *  2. Re-verify the transaction via Flutterwave's API (amount & status check).
 *  3. Use findOneAndUpdate with upsert to create the Order idempotently
 *     (Flutterwave may fire the webhook more than once).
 */
router.post('/webhook', express.json(), async (req, res, next) => {
  try {
    // Step 1 — signature check
    const hash = req.headers['verif-hash'];
    if (!hash || hash !== process.env.FLW_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const event = req.body;
    if (event.event !== 'charge.completed') {
      return res.sendStatus(200); // Acknowledge but ignore non-payment events
    }

    const { id: transactionId, tx_ref: txRef, status, meta } = event.data;

    if (status !== 'successful') {
      return res.sendStatus(200); // Ignore failed/cancelled payments
    }

    // Step 2 — re-verify with Flutterwave (prevents spoofed webhooks)
    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      }
    );
    const verifyData = await verifyRes.json();
    const tx = verifyData.data;

    if (
      !tx ||
      tx.status !== 'successful' ||
      tx.charge_response_code !== '00'
    ) {
      return res.sendStatus(200); // Not actually successful
    }

    // Validate amount against current product price
    const product = await Product.findById(meta.productId);
    if (!product) return res.sendStatus(200);

    const currencyKey = tx.currency.toLowerCase();
    const expectedAmount = product.pricing[currencyKey];
    if (!expectedAmount || tx.amount < expectedAmount) {
      // Amount mismatch — log and skip (do not fulfil)
      console.warn(`[webhook] Amount mismatch for txRef=${txRef}`);
      return res.sendStatus(200);
    }

    // Step 3 — idempotent Order creation
    await Order.findOneAndUpdate(
      { flutterwaveTxRef: txRef },
      {
        $setOnInsert: {
          buyer: meta.buyerId,
          product: meta.productId,
          flutterwaveTxRef: txRef,
          flutterwaveTransactionId: String(transactionId),
          amountCharged: tx.amount,
          currency: tx.currency,
          priceAtPurchase: expectedAmount,
          status: 'completed',
        },
      },
      { upsert: true, new: true }
    );

    // Increment product sales counter (non-blocking)
    Product.findByIdAndUpdate(meta.productId, { $inc: { salesCount: 1 } }).exec();

    // Send purchase receipt email (non-blocking — never delays the 200 response)
    User.findById(meta.buyerId).then((buyer) => {
      if (!buyer) return;
      const frontendUrl = process.env.FRONTEND_URL || 'https://creators.fintigen.com';
      sendPurchaseReceipt({
        buyerName:     buyer.name,
        buyerEmail:    buyer.email,
        productTitle:  product.title,
        productType:   product.productType,
        amountCharged: tx.amount,
        currency:      tx.currency,
        txRef,
        dashboardUrl:  `${frontendUrl}/dashboard`,
      }).catch((e) => console.error('[webhook] receipt email failed:', e.message));
    }).catch(() => {});

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/orders/mine ──────────────────────────────────────────────────
// Authenticated: list all orders for the current buyer
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
      .populate('buyer', 'name email')
      .populate('product', 'title productType')
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
