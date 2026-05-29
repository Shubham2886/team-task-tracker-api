const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout } = require('../controllers/auth.controller');
const { registerValidator, loginValidator } = require('../middleware/validators');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', registerValidator, register);

// POST /api/auth/login
router.post('/login', loginValidator, login);

// POST /api/auth/refresh
router.post('/refresh', refreshToken);

// POST /api/auth/logout
router.post('/logout', authenticate, logout);

module.exports = router;
