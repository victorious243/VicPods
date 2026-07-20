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

module.exports = mongoose.model('PrivateFeedToken', privateFeedTokenSchema);
