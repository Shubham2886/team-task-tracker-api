const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { createError } = require('./errorHandler');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'MISSING_TOKEN', 'Authorization token required'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select('-password -refreshToken');
    if (!user || !user.isActive) {
      return next(createError(401, 'USER_NOT_FOUND', 'User no longer exists'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
