const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAdminDashboardAccess } = require('../middleware/adminAccess');

const router = express.Router();

router.get('/', requireAdminDashboardAccess, adminController.showDashboard);

module.exports = router;
