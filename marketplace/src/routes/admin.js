/**
 * Admin-only routes
 * ──────────────────
 * All routes here require protect + requireAdmin middleware applied
 * at registration time in server.js, so individual routes don't repeat it.
 *
 * Routes:
 *   GET  /api/admin/stats          — Revenue aggregates + top products
 *   GET  /api/admin/users          — List all users (paginated)
 *   PATCH /api/admin/users/:id/toggle — Enable / disable a user account
 */

const express = require('express');
const mongoose = require('mongoose');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const User    = require('../models/User');

const router = express.Router();

// ── GET /api/admin/stats ──────────────────────────────────────────────────
/**
 * Returns:
 *   summary    — { totalOrders, totalBuyers, revenueByProvider, revenueByCurrency }
 *   topProducts — top 8 products by sales count with per-currency revenue breakdown
 *   recentOrders — last 5 orders (for a quick feed)
 *   dailySales   — order count per day for the last 30 days (sparkline data)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalOrders,
      totalBuyers,
      revenueByProvider,
      revenueByCurrency,
      topProducts,
      recentOrders,
      dailySales,
    ] = await Promise.all([

      // Total confirmed orders
      Order.countDocuments({ status: 'completed' }),

      // Distinct buyers who have at least one completed order
      Order.distinct('buyer', { status: 'completed' }).then((ids) => ids.length),

      // Revenue grouped by payment provider
      Order.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id:          '$provider',
            totalOrders:  { $sum: 1 },
            // Sum of amounts — note: mixed currencies, so this is informational only
            // The revenueByCurrency breakdown below is more accurate
          },
        },
        { $sort: { totalOrders: -1 } },
      ]),

      // Revenue grouped by currency (most useful for accounting)
      Order.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id:      '$currency',
            revenue:  { $sum: '$amountCharged' },
            orders:   { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      // Top 8 products by sales count
      Order.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id:        '$product',
            salesCount: { $sum: 1 },
            // Build a currency→revenue map
            revenues: {
              $push: { currency: '$currency', amount: '$amountCharged' },
            },
          },
        },
        { $sort: { salesCount: -1 } },
        { $limit: 8 },
        {
          $lookup: {
            from:         'products',
            localField:   '_id',
            foreignField: '_id',
            as:           'product',
          },
        },
        { $unwind: '$product' },
        {
          $project: {
            salesCount: 1,
            revenues:   1,
            'product._id':         1,
            'product.title':       1,
            'product.productType': 1,
            'product.slug':        1,
          },
        },
      ]),

      // 5 most recent orders
      Order.find({ status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('buyer',   'name email')
        .populate('product', 'title productType'),

      // Daily order counts for the last 30 days
      Order.aggregate([
        {
          $match: {
            status:    'completed',
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            orders:  { $sum: 1 },
            revenue: { $sum: '$amountCharged' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      summary: { totalOrders, totalBuyers, revenueByProvider, revenueByCurrency },
      topProducts,
      recentOrders,
      dailySales,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-passwordHash'),
      User.countDocuments(),
    ]);

    // Attach order count per user
    const userIds  = users.map((u) => u._id);
    const counts   = await Order.aggregate([
      { $match: { buyer: { $in: userIds }, status: 'completed' } },
      { $group: { _id: '$buyer', orders: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.orders]));

    const enriched = users.map((u) => ({
      ...u.toSafeObject(),
      orderCount: countMap[u._id.toString()] ?? 0,
    }));

    res.json({ users: enriched, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/users/:id/toggle ─────────────────────────────────────
router.patch('/users/:id/toggle', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Prevent disabling yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot disable your own account.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/products ───────────────────────────────────────────────
// Returns ALL products regardless of isPublished, so admins can see and
// publish newly created drafts. Private delivery fields are still stripped.
router.get('/products', async (req, res, next) => {
  try {
    const products = await Product.find({})
      .select('-secureFileKey -googleDriveUrl')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
