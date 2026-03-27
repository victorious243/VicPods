const rateLimit = require('express-rate-limit');

const publicGenerateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many preview requests. Please wait a few minutes and try again.',
    });
  },
});

const publicIdeasLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many idea requests. Please wait a few minutes and try again.',
    });
  },
});

const publicSavePreviewLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many save requests. Please wait a few minutes and try again.',
    });
  },
});

const publicExportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many export requests. Please wait a few minutes and try again.',
    });
  },
});

module.exports = {
  publicGenerateLimiter,
  publicIdeasLimiter,
  publicSavePreviewLimiter,
  publicExportLimiter,
};
