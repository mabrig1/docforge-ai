const mongoose = require('mongoose');

const PRODUCT_TYPES = ['book', 'audio'];

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
      // Derived from title on creation; used for SEO-friendly URLs
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

    // ── Media ───────────────────────────────────────────────────────────────
    // Public URL of the cover image (can be Cloudflare R2 or a CDN URL)
    coverImageUrl: {
      type: String,
      required: [true, 'Cover image URL is required'],
    },
    // The R2 object key (path inside the bucket) of the purchasable file.
    // NEVER exposed to the client directly — used only server-side to
    // generate pre-signed URLs after purchase verification.
    // Example: "products/books/shadows-of-the-north.pdf"
    secureFileKey: {
      type: String,
      required: [true, 'Secure file key is required'],
      select: false, // Hidden from all API responses
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
    // For books: author name; for audio: artist name
    creator: {
      type: String,
      trim: true,
    },
    // For audio products: list of track titles (ordered)
    trackList: {
      type: [String],
      default: undefined, // Omitted for books
    },
    // Approximate file size displayed to buyers before purchase
    fileSizeBytes: {
      type: Number,
      min: 0,
      default: null,
    },
    // How many times this product has been purchased (denormalized counter)
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
      .replace(/[^a-z0-9\s-]/g, '')   // strip special chars
      .replace(/\s+/g, '-')            // spaces → hyphens
      .replace(/-+/g, '-')             // collapse multiple hyphens
      .substring(0, 100);
  }
  next();
});

// ── Index for storefront queries ───────────────────────────────────────────
productSchema.index({ isPublished: 1, productType: 1 });
productSchema.index({ slug: 1 });

module.exports = mongoose.model('Product', productSchema);
