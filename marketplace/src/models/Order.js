const mongoose = require('mongoose');

/**
 * Supported currencies — mirrors what Flutterwave returns in the webhook.
 */
const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];

/**
 * An Order is created ONLY after Flutterwave fires a successful payment
 * webhook (status === "successful" && charge_response_code === "00").
 *
 * It is the single source of truth for "has this user purchased this product?"
 * and the gateway to generating a pre-signed download URL.
 */
const orderSchema = new mongoose.Schema(
  {
    // ── Parties ─────────────────────────────────────────────────────────────
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    // ── Payment details (sourced from Flutterwave webhook payload) ──────────
    flutterwaveTxRef: {
      type: String,
      required: true,
      unique: true,   // Idempotency: prevents duplicate orders for the same tx
      trim: true,
    },
    flutterwaveTransactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    amountCharged: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      enum: CURRENCIES,
    },
    // Snapshot of the product price at time of purchase (prices may change)
    priceAtPurchase: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Status ──────────────────────────────────────────────────────────────
    // "completed" is set immediately on webhook receipt; reserved for future
    // refund/dispute workflows.
    status: {
      type: String,
      enum: ['completed', 'refunded', 'disputed'],
      default: 'completed',
    },

    // ── Download tracking ───────────────────────────────────────────────────
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Timestamp of the most recent download link generation
    lastDownloadAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = time of purchase
  }
);

// ── Compound index: quick "has buyer purchased product?" lookup ─────────────
orderSchema.index({ buyer: 1, product: 1 });

module.exports = mongoose.model('Order', orderSchema);
