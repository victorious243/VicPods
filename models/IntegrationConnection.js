const mongoose = require('mongoose');

const INTEGRATION_PROVIDERS = [
  'webhook',
  'zapier',
  'mailchimp',
  'convertkit',
  'buffer',
  'descript',
  'riverside',
  'audio_cleanup',
];

const integrationConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: INTEGRATION_PROVIDERS,
      required: true,
      index: true,
    },
    label: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    endpointUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['configured', 'paused', 'needs_auth'],
      default: 'configured',
      index: true,
    },
    events: {
      type: [String],
      default: [],
    },
    settings: {
      type: Map,
      of: String,
      default: {},
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

integrationConnectionSchema.index({ userId: 1, provider: 1, label: 1 });

module.exports = {
  INTEGRATION_PROVIDERS,
  IntegrationConnection: mongoose.model('IntegrationConnection', integrationConnectionSchema),
};
