const express    = require('express');
const rateLimit  = require('express-rate-limit');
const Order      = require('../models/Order');
const Product    = require('../models/Product');
const { protect }             = require('../middleware/auth');
const { generatePresignedUrl } = require('../services/r2');

const router = express.Router();

/**
 * Per-user download rate limiter.
 *
 * Allows each authenticated user to generate at most 10 pre-signed URLs
 * per 15-minute window — enough for legitimate use but prevents a buyer
 * from flooding R2 with thousands of signed URLs or scraping via automation.
 *
 * The key function uses the authenticated user ID (set by protect middleware)
 * so the limit is per-buyer, not per-IP (which would affect users behind NAT).
 * Falls back to IP if req.user is somehow not set.
 */
const downloadLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  keyGenerator:     (req) => req.user?._id?.toString() ?? req.ip,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many download requests. Please wait 15 minutes and try again.' },
  // Skip the limiter for admin users — they may need bulk access
  skip:             (req) => req.user?.role === 'admin',
});

// ── GET /api/download/:productId ──────────────────────────────────────────
/**
 * Purchase-gated secure download.
 *
 * Steps:
 *  1. protect middleware verifies JWT → req.user
 *  2. downloadLimiter enforces 10 req/15 min per buyer
 *  3. Confirm a completed Order for (buyer, product).
 *  4. Load the Product with secureFileKey (select: false field).
 *  5. Generate a short-lived R2 pre-signed GET URL.
 *  6. Increment downloadCount + record lastDownloadAt (non-blocking).
 *  7. Return the signed URL.
 */
router.get('/:productId', protect, downloadLimiter, async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Step 3 — purchase verification
    const order = await Order.findOne({
      buyer:   req.user._id,
      product: productId,
      status:  'completed',
    });

    if (!order) {
      return res.status(403).json({ error: 'You have not purchased this product.' });
    }

    // Step 4 — load the private file key
    const product = await Product.findById(productId).select('+secureFileKey');
    if (!product || !product.isPublished) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    if (!product.secureFileKey) {
      return res.status(500).json({ error: 'Product file is not yet available.' });
    }

    // Step 5 — generate time-limited signed URL
    const url = await generatePresignedUrl(product.secureFileKey);

    // Step 6 — track (fire-and-forget)
    Order.findByIdAndUpdate(order._id, {
      $inc:          { downloadCount: 1 },
      lastDownloadAt: new Date(),
    }).exec();

    // Step 7 — respond
    res.json({
      downloadUrl:      url,
      expiresInSeconds: Number(process.env.R2_URL_EXPIRES ?? 900),
      productTitle:     product.title,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
