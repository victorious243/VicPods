const mongoose = require('mongoose');

const themeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
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
      trim: true,
      maxlength: 1000,
    },
    orderIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    themeSummary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1200,
    },
  },
  {
    timestamps: true,
  }
);

themeSchema.index({ userId: 1, seriesId: 1, orderIndex: 1 });
themeSchema.index({ userId: 1, seriesId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Theme', themeSchema);
