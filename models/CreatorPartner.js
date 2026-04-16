const mongoose = require('mongoose');

const CREATOR_PARTNER_STATUSES = [
  'contacted',
  'interested',
  'access_sent',
  'testing',
  'approved',
  'posted',
  'converted',
  'not_fit',
];

const creatorPartnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    contactEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      maxlength: 255,
      index: true,
    },
    platform: {
      type: String,
      default: '',
      trim: true,
      maxlength: 40,
    },
    handle: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
    },
    followerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    audienceNiche: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },
    status: {
      type: String,
      enum: CREATOR_PARTNER_STATUSES,
      default: 'contacted',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2400,
    },
    referralCode: {
      type: String,
      default: null,
      trim: true,
      maxlength: 18,
    },
    assignedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    premiumAccessGrantedAt: {
      type: Date,
      default: null,
    },
    premiumAccessExpiresAt: {
      type: Date,
      default: null,
    },
    lastContactedAt: {
      type: Date,
      default: null,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

creatorPartnerSchema.index(
  { referralCode: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      referralCode: { $type: 'string' },
    },
  }
);

module.exports = {
  CreatorPartner: mongoose.model('CreatorPartner', creatorPartnerSchema),
  CREATOR_PARTNER_STATUSES,
};
