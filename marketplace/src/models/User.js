const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['buyer', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'buyer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Soft-link to all orders placed by this user (populated on demand)
    // Not stored here — derived from Order.buyer
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ── Pre-save hook: hash password before writing ─────────────────────────────
userSchema.pre('save', async function (next) {
  // Only re-hash when the password field was actually modified
  if (!this.isModified('passwordHash')) return next();
  const SALT_ROUNDS = 12;
  this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
  next();
});

// ── Instance method: compare a candidate password ──────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// ── Strip sensitive fields from JSON output ────────────────────────────────
userSchema.methods.toSafeObject = function () {
  const { _id, name, email, role, isActive, createdAt } = this;
  return { _id, name, email, role, isActive, createdAt };
};

module.exports = mongoose.model('User', userSchema);
