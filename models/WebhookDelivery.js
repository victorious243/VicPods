const mongoose = require('mongoose');

const webhookDeliverySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    integrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IntegrationConnection',
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    targetUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    payloadPreview: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: ['queued', 'delivered', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    responseCode: {
      type: Number,
      default: null,
    },
    errorMessage: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

webhookDeliverySchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('WebhookDelivery', webhookDeliverySchema);
