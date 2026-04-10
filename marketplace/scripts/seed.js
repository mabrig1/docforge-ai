/**
 * Seed script — run once to populate the DB with sample data.
 *
 * Usage:
 *   node scripts/seed.js              — creates admin + 2 sample products
 *   node scripts/seed.js --wipe       — wipes all users & products first
 *
 * Requires a .env file with MONGODB_URI set.
 *
 * The admin password defaults to ADMIN_PASSWORD env var,
 * or 'Admin@DocForge2024' if not set — CHANGE IT.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// Directly import models (they register themselves with mongoose)
const User    = require('../src/models/User');
const Product = require('../src/models/Product');

const WIPE = process.argv.includes('--wipe');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set. Create a .env file first.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  if (WIPE) {
    await User.deleteMany({});
    await Product.deleteMany({});
    console.log('Wiped users and products.');
  }

  // ── Admin user ─────────────────────────────────────────────────────────
  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@docforge.ai';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@DocForge2024';
  const adminName     = process.env.ADMIN_NAME     || 'Administrator';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    console.log(`Admin already exists: ${adminEmail}`);
  } else {
    // passwordHash triggers bcrypt pre-save hook
    await User.create({ name: adminName, email: adminEmail, passwordHash: adminPassword, role: 'admin' });
    console.log(`Admin created: ${adminEmail}`);
  }

  // ── Sample products ────────────────────────────────────────────────────
  const samples = [
    {
      title:         'Shadows of the North',
      description:
        'A gripping thriller set in the frozen landscapes of Northern Europe. ' +
        'Follow detective Eira Halvorsen as she unravels a conspiracy that stretches ' +
        'from the Arctic tundra to the halls of power in Oslo.',
      productType:   'book',
      coverImageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600',
      secureFileKey: 'products/books/shadows-of-the-north.pdf',
      creator:       'Mabrig Austen',
      pricing:       { ngn: 1500, usd: 5, gbp: 4, eur: 4 },
      fileSizeBytes: 2_400_000,
      isPublished:   true,
    },
    {
      title:         'Echoes of Lagos',
      description:
        'A debut album capturing the energy, spirit, and soul of Lagos through ' +
        'afrobeats, highlife, and spoken-word poetry. 12 original tracks.',
      productType:   'audio',
      coverImageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
      secureFileKey: 'products/audio/echoes-of-lagos-album.zip',
      creator:       'Fela Nwachukwu',
      pricing:       { ngn: 2000, usd: 7, gbp: 5, eur: 6 },
      fileSizeBytes: 95_000_000,
      isPublished:   true,
      trackList: [
        'Lagos Morning',
        'Eko Bridge',
        'Bole & Fish',
        'Rain on Tin Roof',
        'Night Market',
        'Third Mainland Sunset',
        'Mama\'s Voice',
        'Okada Rider',
        'NEPA Blues',
        'Island Girl',
        'Harmattan',
        'Homecoming',
      ],
    },
  ];

  for (const data of samples) {
    const exists = await Product.findOne({ title: data.title });
    if (exists) {
      console.log(`Product already exists: "${data.title}"`);
      continue;
    }
    await Product.create(data);
    console.log(`Product created: "${data.title}"`);
  }

  console.log('\nSeed complete.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
