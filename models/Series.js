const mongoose = require('mongoose');

const seriesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
      trim: true,
    },
    tone: {
      type: String,
      enum: ['fun', 'calm', 'serious'],
      default: 'fun',
    },
    audience: {
      type: String,
      default: '',
      maxlength: 240,
      trim: true,
    },
    plannedEpisodeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    seriesSummary: {
      type: String,
      default: '',
      maxlength: 1200,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

seriesSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('Series', seriesSchema);
