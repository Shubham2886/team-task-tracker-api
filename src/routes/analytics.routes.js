const express = require('express');
const router = express.Router();
const { getAnalytics } = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticate);

// GET /api/analytics — ADMIN or MANAGER
router.get('/', requireRole('ADMIN', 'MANAGER'), getAnalytics);

module.exports = router;
