const { createError } = require('./errorHandler');

// Role hierarchy
const ROLE_PERMISSIONS = {
  ADMIN: ['manage:users', 'manage:projects', 'manage:tasks', 'view:tasks'],
  MANAGER: ['manage:projects', 'manage:tasks', 'view:tasks'],
  MEMBER: ['view:tasks', 'update:own_tasks'],
};

/**
 * Middleware factory — restricts route to specified roles only.
 * RBAC is enforced HERE, not inside controllers.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        createError(
          403,
          'FORBIDDEN',
          `Role ${req.user.role} is not allowed to perform this action. Required: ${allowedRoles.join(' or ')}`
        )
      );
    }

    next();
  };
}

/**
 * Check if user has a specific permission
 */
function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

module.exports = { requireRole, hasPermission, ROLE_PERMISSIONS };
