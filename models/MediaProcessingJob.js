const mongoose = require('mongoose');

const MEDIA_JOB_TYPES = ['audio_metadata', 'clip_suggestions', 'captions', 'quote_cards', 'audio_cleanup', 'descript_export', 'riverside_export', 'recorder_session'];

const mediaProcessingJobSchema = new mongoose.Schema(
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
    jobType: {
      type: String,
      enum: MEDIA_JOB_TYPES,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'ready', 'sent', 'failed'],
      default: 'queued',
      index: true,
    },
    resultUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    lastError: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

mediaProcessingJobSchema.index({ userId: 1, jobType: 1, createdAt: -1 });

module.exports = {
  MEDIA_JOB_TYPES,
  MediaProcessingJob: mongoose.model('MediaProcessingJob', mediaProcessingJobSchema),
};
