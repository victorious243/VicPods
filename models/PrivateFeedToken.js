const crypto = require('crypto');
const mongoose = require('mongoose');

const TOKEN_BYTES = 24;

function createPrivateFeedToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

const privateFeedTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PodcastShow',
      required: true,
      index: true,
    },
    label: {
      type: String,
      default: 'Premium listeners',
      trim: true,
      maxlength: 120,
    },
    accessType: {
      type: String,
      enum: ['creator_managed', 'subscriber_entitlement'],
      default: 'creator_managed',
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 96,
      default: createPrivateFeedToken,
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    subscriberEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: 200,
      index: true,
    },
    subscriberName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    stripeCustomerId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
      index: true,
    },
    stripePriceId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
      index: true,
    },
    checkoutSessionId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    entitlementStatus: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'canceled', 'revoked'],
      default: 'active',
      index: true,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    lastStripeEventType: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    lastValidatedAt: {
      type: Date,
      default: null,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

privateFeedTokenSchema.index({ showId: 1, status: 1 });
privateFeedTokenSchema.index({ showId: 1, accessType: 1, subscriberEmail: 1 });
privateFeedTokenSchema.index({ stripeSubscriptionId: 1, entitlementStatus: 1 });

module.exports = mongoose.model('PrivateFeedToken', privateFeedTokenSchema);
