const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAdminDashboardAccess } = require('../middleware/adminAccess');

const router = express.Router();

router.get('/', requireAdminDashboardAccess, adminController.showDashboard);
router.post('/creator-partners', requireAdminDashboardAccess, adminController.upsertCreatorPartner);
router.post('/creator-partners/:partnerId/grant-access', requireAdminDashboardAccess, adminController.grantCreatorPartnerAccess);

module.exports = router;
