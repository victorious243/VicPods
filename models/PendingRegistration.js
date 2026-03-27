const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    pinHash: {
      type: String,
      default: '',
      maxlength: 128,
    },
    pinExpiresAt: {
      type: Date,
      default: null,
    },
    termsAcceptedAt: {
      type: Date,
      default: null,
    },
    termsAcceptedVersion: {
      type: String,
      default: '',
      maxlength: 40,
    },
    termsAcceptedIp: {
      type: String,
      default: '',
      maxlength: 80,
    },
    referredByCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 18,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
