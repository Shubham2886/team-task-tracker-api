const { validationResult, body, query, param } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join(', ');
    return res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: messages,
    });
  }
  next();
}

// Auth validators
const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('organization').trim().notEmpty().withMessage('Organization is required'),
  body('role')
    .optional()
    .isIn(['ADMIN', 'MANAGER', 'MEMBER'])
    .withMessage('Role must be ADMIN, MANAGER, or MEMBER'),
  validate,
];

const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

// Task validators
const createTaskValidator = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH'])
    .withMessage('Priority must be LOW, MEDIUM, or HIGH'),
  body('assignee').notEmpty().withMessage('Assignee is required').isMongoId().withMessage('Invalid assignee ID'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('due_date must be a valid ISO date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('due_date must be a future date');
      }
      return true;
    }),
  validate,
];

const updateTaskValidator = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim(),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH'])
    .withMessage('Priority must be LOW, MEDIUM, or HIGH'),
  body('assignee').optional().isMongoId().withMessage('Invalid assignee ID'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('due_date must be a valid ISO date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('due_date must be a future date');
      }
      return true;
    }),
  validate,
];

const statusTransitionValidator = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'])
    .withMessage('Invalid status value'),
  validate,
];

const taskListValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'])
    .withMessage('Invalid status filter'),
  query('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH'])
    .withMessage('Invalid priority filter'),
  query('assignee').optional().isMongoId().withMessage('Invalid assignee ID'),
  validate,
];

module.exports = {
  registerValidator,
  loginValidator,
  createTaskValidator,
  updateTaskValidator,
  statusTransitionValidator,
  taskListValidator,
};
