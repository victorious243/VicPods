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
    idempotencyKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 96,
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
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'retrying', 'delivered', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    responseCode: {
      type: Number,
      default: null,
    },
    responseBodyPreview: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    errorMessage: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    attemptLog: {
      type: [
        {
          attemptedAt: {
            type: Date,
            default: Date.now,
          },
          status: {
            type: String,
            default: '',
            trim: true,
            maxlength: 40,
          },
          responseCode: {
            type: Number,
            default: null,
          },
          detail: {
            type: String,
            default: '',
            trim: true,
            maxlength: 1000,
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

webhookDeliverySchema.index({ userId: 1, status: 1, createdAt: -1 });
webhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
webhookDeliverySchema.index(
  { userId: 1, integrationId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } },
  }
);

module.exports = mongoose.model('WebhookDelivery', webhookDeliverySchema);
