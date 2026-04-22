require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const morgan         = require('morgan');
const rateLimit      = require('express-rate-limit');
const cookieParser   = require('cookie-parser');
const mongoSanitize  = require('express-mongo-sanitize');
const connectDB      = require('./config/db');

// ── Routes ─────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const productRoutes  = require('./routes/products');
const orderRoutes    = require('./routes/orders');
const downloadRoutes = require('./routes/download');
const adminRoutes    = require('./routes/admin');
const Product        = require('./models/Product');

const app = express();

// Trust the first proxy hop (Render's load balancer) so express-rate-limit
// sees the real client IP from X-Forwarded-For, not the proxy's address.
app.set('trust proxy', 1);

// ── Security & logging middleware ──────────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// cookie-parser is required for AUTH_MODE=cookie; harmless when unused
app.use(cookieParser());

// CORS — allow configured origins
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed.`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Strip MongoDB operator keys ($gt, $where, etc.) from req.body, req.params,
// and req.query to prevent NoSQL injection attacks.
app.use(mongoSanitize());

// Global rate limiter — 100 requests per 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  })
);

// Body parsers
// Webhook routes need their raw body intact for HMAC signature verification,
// so they receive no pre-parsed body here — each route handles parsing inline:
//   Flutterwave: express.json()          (verif-hash header check, then parse)
//   Paystack:    express.raw({ type })   (SHA-512 HMAC check, then JSON.parse)
const WEBHOOK_PATHS = new Set([
  '/api/orders/webhook/flutterwave',
  '/api/orders/webhook/paystack',
]);
app.use((req, res, next) => {
  if (WEBHOOK_PATHS.has(req.path)) return next();
  express.json({ limit: '1mb' })(req, res, next);
});

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── API routes ─────────────────────────────────────────────────────────────
const { protect, requireAdmin } = require('./middleware/auth');
const { setupBucketCors } = require('./services/r2');
const _admin = [protect, requireAdmin];

app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/admin',    _admin, adminRoutes);

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ── Global error handler ───────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(', ') });
  }
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ error: `A record with that ${field} already exists.` });
  }
  // CORS error
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }

  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// ── Boot ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  // Fix any slugs that were truncated with a trailing hyphen (one-time migration)
  try {
    const broken = await Product.find({ slug: /-$/ }).select('_id slug');
    for (const p of broken) {
      await Product.updateOne({ _id: p._id }, { slug: p.slug.replace(/-+$/, '') });
    }
    if (broken.length > 0) {
      console.log(`Slug migration: fixed ${broken.length} trailing-hyphen slug(s)`);
    }
  } catch (err) {
    console.warn('Slug migration skipped:', err.message);
  }

  await setupBucketCors().catch((err) =>
    console.warn('R2 CORS setup skipped:', err.message)
  );
  app.listen(PORT, () => {
    console.log(`Marketplace API listening on port ${PORT} [${process.env.NODE_ENV}]`);
  });
})();
