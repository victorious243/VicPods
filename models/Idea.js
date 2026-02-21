const mongoose = require('mongoose');

const ideaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hook: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    tag: {
      type: String,
      default: 'general',
      trim: true,
      maxlength: 60,
    },
    notes: {
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

ideaSchema.index({ userId: 1, tag: 1 });

module.exports = mongoose.model('Idea', ideaSchema);
