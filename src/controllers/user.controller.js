const User = require('../models/User');
const { createError } = require('../middleware/errorHandler');

// List all users in the same organization
async function listUsers(req, res, next) {
  try {
    const users = await User.find({ organization: req.user.organization, isActive: true }).select('-password -refreshToken');

    res.json({
      status: 200,
      data: { users, total: users.length },
    });
  } catch (err) {
    next(err);
  }
}

// Get single user (same org only)
async function getUser(req, res, next) {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      organization: req.user.organization,
      isActive: true,
    });

    if (!user) {
      return next(createError(404, 'NOT_FOUND', 'User not found'));
    }

    res.json({ status: 200, data: { user } });
  } catch (err) {
    next(err);
  }
}

// Update user role — ADMIN only
async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!['ADMIN', 'MANAGER', 'MEMBER'].includes(role)) {
      return next(createError(400, 'VALIDATION_ERROR', 'Invalid role'));
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { role },
      { new: true }
    );

    if (!user) {
      return next(createError(404, 'NOT_FOUND', 'User not found'));
    }

    res.json({ status: 200, message: 'Role updated', data: { user } });
  } catch (err) {
    next(err);
  }
}

// Deactivate user — ADMIN only
async function deactivateUser(req, res, next) {
  try {
    if (req.params.id === req.user._id.toString()) {
      return next(createError(400, 'BAD_REQUEST', 'You cannot deactivate yourself'));
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return next(createError(404, 'NOT_FOUND', 'User not found'));
    }

    res.json({ status: 200, message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
}

// Get current logged-in user profile
async function getProfile(req, res, next) {
  try {
    res.json({ status: 200, data: { user: req.user } });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, getUser, updateUserRole, deactivateUser, getProfile };
