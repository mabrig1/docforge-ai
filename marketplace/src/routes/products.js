const express = require('express');
const Product = require('../models/Product');
const { protect, requireAdmin } = require('../middleware/auth');
const { generateUploadPresignedUrl } = require('../services/r2');

const router = express.Router();

const ALLOWED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

// ── GET /api/products ─────────────────────────────────────────────────────
// Public: list published products (with optional ?type=book|audio filter)
router.get('/', async (req, res, next) => {
  try {
    const filter = { isPublished: true };
    if (req.query.type) filter.productType = req.query.type;

    const products = await Product.find(filter)
      .select('-secureFileKey')   // never leak the file key
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/products/:slug ───────────────────────────────────────────────
// Public: single product detail page
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      isPublished: true,
    }).select('-secureFileKey');

    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/products ────────────────────────────────────────────────────
// Admin: create a new product record
router.post('/', protect, requireAdmin, async (req, res, next) => {
  try {
    const {
      title, description, productType, coverImageUrl,
      secureFileKey, pricing, creator, trackList, fileSizeBytes,
    } = req.body;

    const product = await Product.create({
      title, description, productType, coverImageUrl,
      secureFileKey, pricing, creator, trackList, fileSizeBytes,
    });

    // Don't expose secureFileKey in the response
    const safe = product.toObject();
    delete safe.secureFileKey;

    res.status(201).json({ product: safe });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/products/:id ───────────────────────────────────────────────
// Admin: update product fields
router.patch('/:id', protect, requireAdmin, async (req, res, next) => {
  try {
    const UPDATABLE = [
      'title', 'description', 'coverImageUrl', 'pricing',
      'isPublished', 'creator', 'trackList', 'fileSizeBytes', 'secureFileKey',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => UPDATABLE.includes(k))
    );

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-secureFileKey');

    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/products/upload-url ─────────────────────────────────────────
// Admin: get a pre-signed PUT URL for direct-to-R2 file upload
router.post('/upload-url', protect, requireAdmin, async (req, res, next) => {
  try {
    const { objectKey, contentType } = req.body;

    if (!objectKey || !contentType) {
      return res.status(400).json({ error: 'objectKey and contentType are required.' });
    }
    if (!ALLOWED_MIME_TYPES[contentType]) {
      return res.status(400).json({ error: 'Unsupported file type.' });
    }

    const uploadUrl = await generateUploadPresignedUrl(objectKey, contentType);
    res.json({ uploadUrl, objectKey });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
