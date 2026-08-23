const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['page_view', 'download', 'stream', 'purchase_attempt'],
      required: true,
      index: true,
    },
    visitorId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
      index: true,
    },
    path: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 3,
      default: null,
    },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ type: 1, createdAt: -1 });
analyticsEventSchema.index({ product: 1, type: 1, createdAt: -1 });
// Raw analytics are operational telemetry rather than permanent business
// records. Keep one year of events; lifetime order/product counters remain.
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
