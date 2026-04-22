/**
 * Cloudflare R2 Pre-Signed URL Service
 * ──────────────────────────────────────
 * Cloudflare R2 is S3-compatible, so we use the official AWS SDK v3 with a
 * custom endpoint pointing at the R2 jurisdiction-specific URL.
 *
 * Security model
 * ──────────────
 * 1. The R2 bucket is set to PRIVATE — no object is publicly accessible.
 * 2. The `secureFileKey` column in Product is never sent to the client.
 * 3. When a buyer requests a download, the Express route:
 *      a. Verifies the JWT (protect middleware).
 *      b. Queries the Order collection to confirm buyer === req.user._id
 *         AND product === requested product.
 *      c. Only then calls `generatePresignedUrl(secureFileKey)`.
 *      d. Returns a short-lived (default 15 min) signed URL to the client.
 * 4. The URL expires server-side at Cloudflare — even if leaked it becomes
 *    useless after the TTL.
 *
 * Upload flow (admin only, not exposed publicly)
 * ──────────────────────────────────────────────
 * Admin uses `generateUploadPresignedUrl` to get a one-time PUT URL,
 * uploads the file directly from the browser to R2 (no server bandwidth),
 * then saves the resulting object key in Product.secureFileKey.
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ── Build S3-compatible client pointing at Cloudflare R2 ──────────────────
function buildR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error('R2_ACCOUNT_ID is not set.');

  return new S3Client({
    region: 'auto', // R2 uses "auto" as the region identifier
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    // R2 doesn't support AWS SDK v3's automatic CRC32 checksum injection.
    // Without these, the presigned PUT URL includes x-amz-checksum-crc32 as a
    // required query param, but the browser XHR never sends the header → 400.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

// Lazily instantiated so the server can start without env vars during tests
let _client = null;
function getClient() {
  if (!_client) _client = buildR2Client();
  return _client;
}

const BUCKET = () => {
  const b = process.env.R2_BUCKET_NAME;
  if (!b) throw new Error('R2_BUCKET_NAME is not set.');
  return b;
};

/**
 * Generates a time-limited GET URL for a private R2 object.
 *
 * @param {string} objectKey   - The R2 object key, e.g. "products/books/shadows.pdf"
 * @param {number} [expiresIn] - Lifetime in seconds (default: env R2_URL_EXPIRES or 900)
 * @returns {Promise<string>}  - The signed URL
 */
async function generatePresignedUrl(objectKey, expiresIn) {
  const ttl = expiresIn ?? Number(process.env.R2_URL_EXPIRES ?? 900);
  const command = new GetObjectCommand({
    Bucket: BUCKET(),
    Key: objectKey,
    // Instruct the browser to download (not open inline)
    ResponseContentDisposition: `attachment; filename="${objectKey.split('/').pop()}"`,
  });
  return getSignedUrl(getClient(), command, { expiresIn: ttl });
}

/**
 * Generates a time-limited PUT URL so an admin client can upload a file
 * directly to R2 without routing it through the Express server.
 *
 * @param {string} objectKey    - Destination key in the bucket
 * @param {string} contentType  - MIME type of the file, e.g. "application/pdf"
 * @param {number} [expiresIn]  - Lifetime in seconds (default: 300)
 * @returns {Promise<string>}   - The signed upload URL
 */
async function generateUploadPresignedUrl(objectKey, contentType, expiresIn = 300) {
  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

module.exports = { generatePresignedUrl, generateUploadPresignedUrl };
