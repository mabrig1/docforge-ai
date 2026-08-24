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
const AnalyticsEvent = require('../models/AnalyticsEvent');

const router = express.Router();

// ── GET /api/admin/stats ──────────────────────────────────────────────────
/**
 * Store performance overview. Lifetime counters preserve historical product
 * activity, while the 30-day series is built from privacy-safe analytics
 * events recorded after this release.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const since30Days = new Date();
    since30Days.setUTCDate(since30Days.getUTCDate() - 29);
    since30Days.setUTCHours(0, 0, 0, 0);

    const [
      totalOrders,
      totalBuyers,
      revenueByProvider,
      revenueByCurrency,
      topProducts,
      recentOrders,
      dailySales,
      totalVisitors,
      visitors30Days,
      totalPageViews,
      totalPurchaseAttempts,
      purchaseAttempts30Days,
      dailyEvents,
      dailyVisitors,
      deliveryTotalsRows,
      paidDownloadRows,
      productPerformance,
    ] = await Promise.all([
      Order.countDocuments({ status: 'completed' }),
      Order.distinct('buyer', { status: 'completed' }).then((ids) => ids.length),

      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$provider', totalOrders: { $sum: 1 } } },
        { $sort: { totalOrders: -1 } },
      ]),

      Order.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$currency',
            revenue: { $sum: '$amountCharged' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      Order.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$product',
            salesCount: { $sum: 1 },
            revenues: { $push: { currency: '$currency', amount: '$amountCharged' } },
          },
        },
        { $sort: { salesCount: -1 } },
        { $limit: 8 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $project: {
            salesCount: 1,
            revenues: 1,
            'product.title': 1,
            'product.productType': 1,
          },
        },
      ]),

      Order.find({ status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('buyer', 'name email')
        .populate('product', 'title productType')
        .lean(),

      Order.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: since30Days } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      AnalyticsEvent.distinct('visitorId', {
        type: 'page_view',
        visitorId: { $ne: null },
      }).then((ids) => ids.length),

      AnalyticsEvent.distinct('visitorId', {
        type: 'page_view',
        visitorId: { $ne: null },
        createdAt: { $gte: since30Days },
      }).then((ids) => ids.length),

      AnalyticsEvent.countDocuments({ type: 'page_view' }),
      AnalyticsEvent.countDocuments({ type: 'purchase_attempt' }),
      AnalyticsEvent.countDocuments({
        type: 'purchase_attempt',
        createdAt: { $gte: since30Days },
      }),

      AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since30Days } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              type: '$type',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.day': 1 } },
      ]),

      AnalyticsEvent.aggregate([
        {
          $match: {
            type: 'page_view',
            visitorId: { $ne: null },
            createdAt: { $gte: since30Days },
          },
        },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              visitorId: '$visitorId',
            },
          },
        },
        { $group: { _id: '$_id.day', visitors: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      Product.aggregate([
        {
          $group: {
            _id: null,
            totalStreams: { $sum: { $ifNull: ['$streamCount', 0] } },
            freeDownloads: { $sum: { $ifNull: ['$freeDownloadCount', 0] } },
          },
        },
      ]),

      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, paidDownloads: { $sum: { $ifNull: ['$downloadCount', 0] } } } },
      ]),

      Product.find({ isPublished: true })
        .select('title slug productType streamCount freeDownloadCount salesCount isFree')
        .sort({ streamCount: -1, freeDownloadCount: -1, salesCount: -1 })
        .limit(10)
        .lean(),
    ]);

    const deliveryTotals = deliveryTotalsRows[0] || { totalStreams: 0, freeDownloads: 0 };
    const paidDownloads = paidDownloadRows[0]?.paidDownloads || 0;

    const activityByDay = new Map();
    for (let offset = 0; offset < 30; offset += 1) {
      const day = new Date(since30Days);
      day.setUTCDate(day.getUTCDate() + offset);
      const key = day.toISOString().slice(0, 10);
      activityByDay.set(key, {
        date: key,
        visitors: 0,
        pageViews: 0,
        downloads: 0,
        streams: 0,
        purchaseAttempts: 0,
        completedPurchases: 0,
      });
    }

    dailyVisitors.forEach((row) => {
      const entry = activityByDay.get(row._id);
      if (entry) entry.visitors = row.visitors;
    });

    const eventField = {
      page_view: 'pageViews',
      download: 'downloads',
      stream: 'streams',
      purchase_attempt: 'purchaseAttempts',
    };
    dailyEvents.forEach((row) => {
      const entry = activityByDay.get(row._id.day);
      const field = eventField[row._id.type];
      if (entry && field) entry[field] = row.count;
    });
    dailySales.forEach((row) => {
      const entry = activityByDay.get(row._id);
      if (entry) entry.completedPurchases = row.orders;
    });

    res.json({
      summary: {
        totalOrders,
        totalBuyers,
        totalVisitors,
        visitors30Days,
        totalPageViews,
        totalDownloads: deliveryTotals.freeDownloads + paidDownloads,
        freeDownloads: deliveryTotals.freeDownloads,
        paidDownloads,
        totalStreams: deliveryTotals.totalStreams,
        totalPurchaseAttempts,
        purchaseAttempts30Days,
        revenueByProvider,
        revenueByCurrency,
      },
      activity: Array.from(activityByDay.values()),
      topProducts,
      productPerformance,
      recentOrders,
      dailySales,
      trackingNotice: 'Visitor and purchase-attempt trends begin from the analytics deployment date.',
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
