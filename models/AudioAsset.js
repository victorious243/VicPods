const mongoose = require('mongoose');

const audioAssetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    episodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Episode',
      required: true,
      index: true,
    },
    storageProvider: {
      type: String,
      enum: ['local_public', 'remote_url'],
      default: 'local_public',
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },
    originalFilename: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    mimeType: {
      type: String,
      default: 'audio/mpeg',
      trim: true,
      maxlength: 120,
    },
    byteSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadataStatus: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'pending',
      index: true,
    },
    durationSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    bitrateKbps: {
      type: Number,
      default: null,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ready', 'replaced'],
      default: 'ready',
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

audioAssetSchema.index({ userId: 1, episodeId: 1, createdAt: -1 });

module.exports = mongoose.model('AudioAsset', audioAssetSchema);
