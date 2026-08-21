const express    = require('express');
const rateLimit  = require('express-rate-limit');
const mongoose   = require('mongoose');
const Order      = require('../models/Order');
const Product    = require('../models/Product');
const { protect }             = require('../middleware/auth');
const { generatePresignedUrl } = require('../services/r2');

const router = express.Router();

/**
 * Per-user download rate limiter.
 * 10 pre-signed URLs per 15 minutes per buyer (not per IP).
 * Admin users are exempt.
 */
const downloadLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  keyGenerator:     (req) => req.user?._id?.toString() ?? req.ip,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many download requests. Please wait 15 minutes and try again.' },
  skip:             (req) => req.user?.role === 'admin',
});

// ── GET /api/download/free/:productId ─────────────────────────────────────
/**
 * Public download for products explicitly marked free by an administrator.
 * Private storage fields remain hidden; R2 downloads use short-lived signed
 * URLs and Google Drive links are returned only for published free products.
 */
router.get('/free/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid productId.' });
    }

    const product = await Product.findOne({
      _id: productId,
      isPublished: true,
      isFree: true,
    }).select('+secureFileKey +googleDriveUrl');

    if (!product) {
      return res.status(404).json({ error: 'Free product not found.' });
    }

    const method = product.deliveryMethod || 'r2';
    let downloadUrl;
    let isExternalLink = false;
    let expiresInSeconds = null;

    if (method === 'google_drive') {
      if (!product.googleDriveUrl) {
        return res.status(500).json({ error: 'Product file is not yet available.' });
      }
      downloadUrl = product.googleDriveUrl;
      isExternalLink = true;
    } else {
      if (!product.secureFileKey) {
        return res.status(500).json({ error: 'Product file is not yet available.' });
      }
      downloadUrl = await generatePresignedUrl(product.secureFileKey);
      expiresInSeconds = Number(process.env.R2_URL_EXPIRES ?? 900);
    }

    Product.updateOne(
      { _id: product._id },
      { $inc: { freeDownloadCount: 1 } }
    ).exec().catch(() => {});

    res.json({
      downloadUrl,
      isExternalLink,
      expiresInSeconds,
      productTitle: product.title,
      deliveryMethod: method,
      isFree: true,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/download/:productId ──────────────────────────────────────────
/**
 * Purchase-gated secure download.
 *
 * Handles two delivery methods:
 *   deliveryMethod === 'r2'
 *     Generates a short-lived Cloudflare R2 pre-signed GET URL.
 *   deliveryMethod === 'google_drive'
 *     Returns the private Google Drive share URL (never exposed until purchased).
 *
 * Steps:
 *  1. protect middleware verifies JWT → req.user
 *  2. downloadLimiter: 10 req/15 min per buyer
 *  3. Confirm a completed Order for (buyer, product)
 *  4. Load Product with hidden fields (+secureFileKey +googleDriveUrl)
 *  5. Generate delivery URL based on deliveryMethod
 *  6. Increment downloadCount + lastDownloadAt (non-blocking)
 *  7. Return response
 */
router.get('/:productId', protect, downloadLimiter, async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid productId.' });
    }

    // Step 3 — purchase verification
    const order = await Order.findOne({
      buyer:   req.user._id,
      product: productId,
      status:  'completed',
    });

    if (!order) {
      return res.status(403).json({ error: 'You have not purchased this product.' });
    }

    // Step 4 — load the private delivery fields
    const product = await Product.findById(productId)
      .select('+secureFileKey +googleDriveUrl');

    if (!product || !product.isPublished) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Step 5 — build the delivery URL based on method
    const method = product.deliveryMethod || 'r2';
    let downloadUrl;
    let isExternalLink = false;
    let expiresInSeconds = null;

    if (method === 'google_drive') {
      if (!product.googleDriveUrl) {
        return res.status(500).json({ error: 'Product file is not yet available.' });
      }
      downloadUrl    = product.googleDriveUrl;
      isExternalLink = true;
    } else {
      // r2 (default)
      if (!product.secureFileKey) {
        return res.status(500).json({ error: 'Product file is not yet available.' });
      }
      downloadUrl    = await generatePresignedUrl(product.secureFileKey);
      expiresInSeconds = Number(process.env.R2_URL_EXPIRES ?? 900);
    }

    // Step 6 — track (fire-and-forget)
    Order.findByIdAndUpdate(order._id, {
      $inc:          { downloadCount: 1 },
      lastDownloadAt: new Date(),
    }).exec();

    // Step 7 — respond
    res.json({
      downloadUrl,
      isExternalLink,
      expiresInSeconds,
      productTitle:  product.title,
      deliveryMethod: method,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
