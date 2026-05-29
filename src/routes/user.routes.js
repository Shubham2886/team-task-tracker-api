const express = require('express');
const router = express.Router();
const { listUsers, getUser, updateUserRole, deactivateUser, getProfile } = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All user routes require authentication
router.use(authenticate);

// GET /api/users/me
router.get('/me', getProfile);

// GET /api/users — all roles can list org members (to assign tasks)
router.get('/', listUsers);

// GET /api/users/:id
router.get('/:id', getUser);

// PATCH /api/users/:id/role — ADMIN only
router.patch('/:id/role', requireRole('ADMIN'), updateUserRole);

// DELETE /api/users/:id — ADMIN only
router.delete('/:id', requireRole('ADMIN'), deactivateUser);

module.exports = router;
