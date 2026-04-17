const mongoose = require('mongoose');

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];
const PROVIDERS  = ['flutterwave', 'paystack', 'paypal'];

/**
 * An Order is created ONLY after a verified payment webhook fires.
 *
 * It is the single source of truth for "has this user purchased this product?"
 * and the gateway to generating a pre-signed download URL.
 *
 * Both Flutterwave and Paystack orders share this schema.
 * Provider-specific reference fields use `sparse: true` so the unique index
 * only applies to documents where the field is actually set.
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

    // ── Payment provider ────────────────────────────────────────────────────
    provider: {
      type: String,
      enum: PROVIDERS,
      required: true,
      default: 'flutterwave',
    },

    // ── Flutterwave fields (set when provider === 'flutterwave') ────────────
    // sparse: true — unique constraint only applies to non-null values
    flutterwaveTxRef: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    flutterwaveTransactionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // ── PayPal fields (set when provider === 'paypal') ─────────────────────
    paypalOrderId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    paypalCaptureId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // ── Paystack fields (set when provider === 'paystack') ──────────────────
    paystackReference: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    paystackTransactionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // ── Shared payment details ──────────────────────────────────────────────
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
