const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const { generatePresignedUrl } = require('../services/r2');

const router = express.Router();

// ── GET /api/download/:productId ──────────────────────────────────────────
/**
 * Purchase-gated secure download.
 *
 * Steps:
 *  1. `protect` middleware verifies JWT → req.user
 *  2. Confirm a completed Order exists for (buyer, product) pair.
 *  3. Load the Product WITH secureFileKey (normally excluded by select:false).
 *  4. Generate a short-lived R2 pre-signed URL for that key.
 *  5. Increment downloadCount and record lastDownloadAt on the Order.
 *  6. Return the signed URL — client redirects the browser to it.
 *
 * The signed URL expires in R2_URL_EXPIRES seconds (default 900 = 15 min).
 * Even if the URL leaks it becomes invalid after that window.
 */
router.get('/:productId', protect, async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Step 2 — verify purchase
    const order = await Order.findOne({
      buyer: req.user._id,
      product: productId,
      status: 'completed',
    });

    if (!order) {
      return res.status(403).json({
        error: 'You have not purchased this product.',
      });
    }

    // Step 3 — load the private file key (select: false field)
    const product = await Product.findById(productId).select('+secureFileKey');
    if (!product || !product.isPublished) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (!product.secureFileKey) {
      return res.status(500).json({ error: 'Product file is not yet available.' });
    }

    // Step 4 — generate a time-limited signed URL
    const url = await generatePresignedUrl(product.secureFileKey);

    // Step 5 — update download tracking (fire-and-forget, non-blocking)
    Order.findByIdAndUpdate(order._id, {
      $inc: { downloadCount: 1 },
      lastDownloadAt: new Date(),
    }).exec();

    // Step 6 — return the URL
    res.json({
      downloadUrl: url,
      expiresInSeconds: Number(process.env.R2_URL_EXPIRES ?? 900),
      productTitle: product.title,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
