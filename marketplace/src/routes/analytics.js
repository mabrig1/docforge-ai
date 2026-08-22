const express = require('express');
const AnalyticsEvent = require('../models/AnalyticsEvent');

const router = express.Router();
const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,100}$/;

/**
 * Records privacy-safe storefront page views. The browser creates a random
 * identifier and stores it locally; no name, email, or raw IP is retained.
 */
router.post('/event', async (req, res, next) => {
  try {
    const { type, visitorId, path } = req.body || {};

    if (type !== 'page_view') {
      return res.status(400).json({ error: 'Only page_view events are accepted here.' });
    }
    if (!VISITOR_ID_RE.test(visitorId || '')) {
      return res.status(400).json({ error: 'A valid visitorId is required.' });
    }

    const safePath = typeof path === 'string'
      ? (path.split('?')[0].slice(0, 300) || '/')
      : '/';

    await AnalyticsEvent.create({
      type: 'page_view',
      visitorId,
      path: safePath,
    });

    res.status(202).json({ recorded: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
