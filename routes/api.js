const express = require('express');

const apiController = require('../controllers/apiController');
const { authLimiter } = require('../middleware/authRateLimit');
const publicApiController = require('../controllers/publicApiController');
const {
  publicExportLimiter,
  publicGenerateLimiter,
  publicIdeasLimiter,
  publicSavePreviewLimiter,
} = require('../middleware/publicApiRateLimit');

const router = express.Router();

router.post('/public/generate', publicGenerateLimiter, publicApiController.generateEpisodePreview);
router.post('/public/podcast-ideas', publicIdeasLimiter, publicApiController.generatePodcastIdeas);
router.post('/public/save-preview', publicSavePreviewLimiter, publicApiController.savePreviewLead);
router.post('/public/export-preview', publicExportLimiter, publicApiController.exportPreview);

router.post('/auth/register', authLimiter, apiController.register);
router.post('/auth/login', authLimiter, apiController.login);
router.post('/auth/password/forgot', authLimiter, apiController.forgotPassword);
router.post('/auth/password/reset', authLimiter, apiController.resetPassword);
router.post('/auth/verify', authLimiter, apiController.verifyRegistration);
router.post('/auth/verify/resend', authLimiter, apiController.resendRegistrationPin);
router.get('/auth/session', apiController.session);
router.post('/auth/logout', apiController.logout);

router.get('/studio', apiController.studio);
router.post('/episodes/:episodeId/share/copied', apiController.markEpisodeShareCopied);

module.exports = router;
