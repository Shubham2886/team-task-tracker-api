const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { createError } = require('../middleware/errorHandler');

async function register(req, res, next) {
  try {
    const { name, email, password, organization, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createError(409, 'DUPLICATE_ERROR', 'Email already registered'));
    }

    const user = await User.create({ name, email, password, organization, role: role || 'MEMBER' });

    const accessToken = generateAccessToken({ userId: user._id, role: user.role, organization: user.organization });
    const refreshToken = generateRefreshToken({ userId: user._id });

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      status: 201,
      message: 'Registration successful',
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user || !user.isActive) {
      return next(createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    const accessToken = generateAccessToken({ userId: user._id, role: user.role, organization: user.organization });
    const refreshToken = generateRefreshToken({ userId: user._id });

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      status: 200,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return next(createError(400, 'MISSING_TOKEN', 'Refresh token is required'));
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      return next(createError(401, 'INVALID_TOKEN', 'Refresh token is invalid or expired'));
    }

    // Rotate refresh token
    const newAccessToken = generateAccessToken({ userId: user._id, role: user.role, organization: user.organization });
    const newRefreshToken = generateRefreshToken({ userId: user._id });

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      status: 200,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+refreshToken');
    if (user) {
      user.refreshToken = null;
      await user.save({ validateBeforeSave: false });
    }

    res.json({ status: 200, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refreshToken, logout };
