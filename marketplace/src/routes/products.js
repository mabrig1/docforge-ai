const express  = require('express');
const mongoose = require('mongoose');
const Product  = require('../models/Product');
const { protect, requireAdmin } = require('../middleware/auth');
const { generateUploadPresignedUrl } = require('../services/r2');

const router = express.Router();

const ALLOWED_MIME_TYPES = {
  'application/pdf':   'pdf',
  'application/epub+zip': 'epub',
  'audio/mpeg':        'mp3',
  'audio/wav':         'wav',
  'audio/x-wav':       'wav',
};

const VALID_PRODUCT_TYPES  = new Set(['book', 'audio']);
const VALID_DELIVERY_METHODS = new Set(['r2', 'google_drive']);

/**
 * Validates an R2 object key to prevent path traversal.
 * Allows: alphanumeric, hyphens, underscores, dots, forward slashes.
 * Rejects: ".." sequences, null bytes, or any other special character.
 */
function isSafeObjectKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 1024) return false;
  if (/\.\./.test(key)) return false;   // path traversal
  if (/\0/.test(key)) return false;     // null bytes
  return /^[\w.\-/]+$/.test(key);      // allowlist
}

// ── GET /api/products ─────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const filter = { isPublished: true };
    if (req.query.type) {
      if (!VALID_PRODUCT_TYPES.has(req.query.type)) {
        return res.status(400).json({ error: 'Invalid type. Must be book or audio.' });
      }
      filter.productType = req.query.type;
    }

    const products = await Product.find(filter)
      .select('-secureFileKey -googleDriveUrl') // never leak private fields
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/products/:slug ───────────────────────────────────────────────
router.get('/:slug', async (req, res, next) => {
  try {
    // Normalize: strip trailing hyphens produced when a long title is truncated
    // at a word boundary during slug generation (e.g. shared Facebook URLs).
    const slug = req.params.slug.replace(/-+$/, '');
    const product = await Product.findOne({
      slug,
      isPublished: true,
    }).select('-secureFileKey -googleDriveUrl');

    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/products ────────────────────────────────────────────────────
router.post('/', protect, requireAdmin, async (req, res, next) => {
  try {
    const {
      title, description, productType, coverImageUrl,
      deliveryMethod = 'r2', secureFileKey, googleDriveUrl,
      pricing, creator, trackList, fileSizeBytes, isFree = false,
    } = req.body;

    // Validate delivery method and its required field
    if (!VALID_DELIVERY_METHODS.has(deliveryMethod)) {
      return res.status(400).json({ error: 'Invalid deliveryMethod. Must be r2 or google_drive.' });
    }
    if (deliveryMethod === 'r2' && !secureFileKey) {
      return res.status(400).json({ error: 'secureFileKey is required for R2 delivery.' });
    }
    if (deliveryMethod === 'google_drive' && !googleDriveUrl) {
      return res.status(400).json({ error: 'googleDriveUrl is required for Google Drive delivery.' });
    }

    const product = await Product.create({
      title, description, productType, coverImageUrl,
      deliveryMethod, secureFileKey, googleDriveUrl,
      pricing, creator, trackList, fileSizeBytes, isFree: Boolean(isFree),
    });

    // Strip private fields from response
    const safe = product.toObject();
    delete safe.secureFileKey;
    delete safe.googleDriveUrl;

    res.status(201).json({ product: safe });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/products/:id ───────────────────────────────────────────────
router.patch('/:id', protect, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }

    const UPDATABLE = [
      'title', 'description', 'coverImageUrl', 'pricing',
      'isPublished', 'creator', 'trackList', 'fileSizeBytes',
      'deliveryMethod', 'secureFileKey', 'googleDriveUrl', 'isFree',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => UPDATABLE.includes(k))
    );

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-secureFileKey -googleDriveUrl');

    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/products/upload-url ─────────────────────────────────────────
router.post('/upload-url', protect, requireAdmin, async (req, res, next) => {
  try {
    const { objectKey, contentType } = req.body;

    if (!objectKey || !contentType) {
      return res.status(400).json({ error: 'objectKey and contentType are required.' });
    }
    if (!ALLOWED_MIME_TYPES[contentType]) {
      return res.status(400).json({ error: 'Unsupported file type.' });
    }
    if (!isSafeObjectKey(objectKey)) {
      return res.status(400).json({ error: 'Invalid objectKey.' });
    }

    const uploadUrl = await generateUploadPresignedUrl(objectKey, contentType);
    res.json({ uploadUrl, objectKey });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
