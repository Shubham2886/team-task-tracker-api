const express = require('express');
const router = express.Router();
const {
  createTask,
  listTasks,
  getTask,
  updateTask,
  transitionStatus,
  deleteTask,
} = require('../controllers/task.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  createTaskValidator,
  updateTaskValidator,
  statusTransitionValidator,
  taskListValidator,
} = require('../middleware/validators');

router.use(authenticate);

// GET /api/tasks — all roles (MEMBER sees only own tasks — enforced in controller)
router.get('/', taskListValidator, listTasks);

// POST /api/tasks — ADMIN or MANAGER
router.post('/', requireRole('ADMIN', 'MANAGER'), createTaskValidator, createTask);

// GET /api/tasks/:id — all roles (ownership check in controller)
router.get('/:id', getTask);

// PATCH /api/tasks/:id — ADMIN or MANAGER
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), updateTaskValidator, updateTask);

// PATCH /api/tasks/:id/status — any role (assignee + MANAGER/ADMIN check in controller)
router.patch('/:id/status', statusTransitionValidator, transitionStatus);

// DELETE /api/tasks/:id — ADMIN only
router.delete('/:id', requireRole('ADMIN'), deleteTask);

module.exports = router;
