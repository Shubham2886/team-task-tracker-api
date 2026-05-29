function errorHandler(err, req, res, next) {
  console.error(err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: messages.join(', '),
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      status: 409,
      code: 'DUPLICATE_ERROR',
      message: `${field} already exists`,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Token has expired',
    });
  }

  // Custom app errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      status: err.statusCode,
      code: err.code || 'APP_ERROR',
      message: err.message,
    });
  }

  // Generic 500
  res.status(500).json({
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong',
  });
}

function createError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

module.exports = { errorHandler, createError };
