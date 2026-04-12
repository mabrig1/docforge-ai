const mongoose = require('mongoose');

const PRODUCT_TYPES     = ['book', 'audio'];
const DELIVERY_METHODS  = ['r2', 'google_drive'];

/**
 * Multi-currency pricing sub-document.
 * At least one currency must be set; others are optional but recommended.
 */
const pricingSchema = new mongoose.Schema(
  {
    ngn: { type: Number, min: 0, default: null }, // Nigerian Naira
    usd: { type: Number, min: 0, default: null }, // US Dollar
    gbp: { type: Number, min: 0, default: null }, // British Pound
    eur: { type: Number, min: 0, default: null }, // Euro
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    productType: {
      type: String,
      required: true,
      enum: PRODUCT_TYPES,
    },

    // ── Delivery ────────────────────────────────────────────────────────────
    /**
     * How the file is delivered after purchase:
     *   'r2'           — file lives in Cloudflare R2; generate a presigned URL
     *   'google_drive' — file is shared via Google Drive; return the drive URL
     */
    deliveryMethod: {
      type: String,
      enum: DELIVERY_METHODS,
      default: 'r2',
    },

    // ── Media ───────────────────────────────────────────────────────────────
    coverImageUrl: {
      type: String,
      required: [true, 'Cover image URL is required'],
    },
    /**
     * R2 object key (path inside the bucket) for files stored on Cloudflare R2.
     * Required when deliveryMethod === 'r2'.
     * NEVER exposed in API responses — hidden with select: false.
     */
    secureFileKey: {
      type: String,
      select: false,
    },
    /**
     * Google Drive share URL for files linked from Google Drive.
     * Required when deliveryMethod === 'google_drive'.
     * Hidden from public API — only revealed to the buyer after purchase.
     */
    googleDriveUrl: {
      type: String,
      trim: true,
      select: false,
    },

    // ── Pricing ─────────────────────────────────────────────────────────────
    pricing: {
      type: pricingSchema,
      required: true,
    },

    // ── Metadata ────────────────────────────────────────────────────────────
    isPublished: {
      type: Boolean,
      default: false,
    },
    creator: {
      type: String,
      trim: true,
    },
    trackList: {
      type: [String],
      default: undefined,
    },
    fileSizeBytes: {
      type: Number,
      min: 0,
      default: null,
    },
    salesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ── Auto-generate slug from title ──────────────────────────────────────────
productSchema.pre('validate', function (next) {
  if (this.isNew && this.title && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
  }
  next();
});

// ── Index for storefront queries ───────────────────────────────────────────
productSchema.index({ isPublished: 1, productType: 1 });
productSchema.index({ slug: 1 });

module.exports = mongoose.model('Product', productSchema);
