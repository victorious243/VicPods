const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAdminDashboardAccess } = require('../middleware/adminAccess');

const router = express.Router();

router.get('/', requireAdminDashboardAccess, adminController.showDashboard);
router.post('/tester-trials', requireAdminDashboardAccess, adminController.createTesterTrialInvite);
router.post('/tester-trials/:inviteId/toggle', requireAdminDashboardAccess, adminController.toggleTesterTrialInvite);
router.post('/creator-partners', requireAdminDashboardAccess, adminController.upsertCreatorPartner);
router.post('/creator-partners/:partnerId/grant-access', requireAdminDashboardAccess, adminController.grantCreatorPartnerAccess);

module.exports = router;
