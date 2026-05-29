const Task = require('../models/Task');
const User = require('../models/User');
const { createError } = require('../middleware/errorHandler');
const {
  buildTaskCacheKey,
  getCache,
  setCache,
  invalidateAssigneeCache,
} = require('../utils/cache');

// Create Task — ADMIN or MANAGER
async function createTask(req, res, next) {
  try {
    const { title, description, priority, assignee, due_date } = req.body;

    // Verify assignee belongs to same organization
    const assigneeUser = await User.findOne({ _id: assignee, organization: req.user.organization, isActive: true });
    if (!assigneeUser) {
      return next(createError(404, 'NOT_FOUND', 'Assignee not found in your organization'));
    }

    const task = await Task.create({
      title,
      description,
      priority: priority || 'MEDIUM',
      assignee,
      createdBy: req.user._id,
      organization: req.user.organization,
      due_date,
    });

    await task.populate('assignee', 'name email role');
    await task.populate('createdBy', 'name email');

    // Invalidate assignee's cache since they have a new task
    await invalidateAssigneeCache(assignee);

    res.status(201).json({ status: 201, message: 'Task created', data: { task } });
  } catch (err) {
    next(err);
  }
}

// List Tasks with pagination and filtering, Redis cache per assignee
async function listTasks(req, res, next) {
  try {
    const { status, priority, assignee, page = 1, limit = 20 } = req.query;
    const user = req.user;

    // Build filter — always scope to organization
    const filter = { organization: user.organization };

    // MEMBER can only see their own tasks
    if (user.role === 'MEMBER') {
      filter.assignee = user._id;
    } else if (assignee) {
      filter.assignee = assignee;
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // Try cache for assignee-filtered queries
    const cacheAssignee = user.role === 'MEMBER' ? user._id.toString() : assignee;
    let cacheKey = null;
    if (cacheAssignee) {
      cacheKey = buildTaskCacheKey(cacheAssignee, { status, priority, page, limit });
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({ status: 200, data: cached, meta: { fromCache: true } });
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('assignee', 'name email role')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Task.countDocuments(filter),
    ]);

    const result = {
      tasks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };

    // Cache the result if assignee-scoped
    if (cacheKey) {
      await setCache(cacheKey, result);
    }

    res.json({ status: 200, data: result });
  } catch (err) {
    next(err);
  }
}

// Get single task
async function getTask(req, res, next) {
  try {
    const task = await Task.findOne({ _id: req.params.id, organization: req.user.organization })
      .populate('assignee', 'name email role')
      .populate('createdBy', 'name email');

    if (!task) {
      return next(createError(404, 'NOT_FOUND', 'Task not found'));
    }

    // MEMBER can only view their own tasks
    if (req.user.role === 'MEMBER' && task.assignee._id.toString() !== req.user._id.toString()) {
      return next(createError(403, 'FORBIDDEN', 'You can only view tasks assigned to you'));
    }

    res.json({ status: 200, data: { task } });
  } catch (err) {
    next(err);
  }
}

// Update Task fields — ADMIN or MANAGER
async function updateTask(req, res, next) {
  try {
    const { title, description, priority, assignee, due_date } = req.body;

    const task = await Task.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!task) {
      return next(createError(404, 'NOT_FOUND', 'Task not found'));
    }

    const oldAssignee = task.assignee.toString();

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (due_date) task.due_date = due_date;

    if (assignee && assignee !== oldAssignee) {
      const assigneeUser = await User.findOne({ _id: assignee, organization: req.user.organization, isActive: true });
      if (!assigneeUser) {
        return next(createError(404, 'NOT_FOUND', 'New assignee not found in your organization'));
      }
      task.assignee = assignee;
      // Invalidate both old and new assignee caches
      await invalidateAssigneeCache(oldAssignee);
      await invalidateAssigneeCache(assignee);
    } else {
      await invalidateAssigneeCache(oldAssignee);
    }

    await task.save();
    await task.populate('assignee', 'name email role');
    await task.populate('createdBy', 'name email');

    res.json({ status: 200, message: 'Task updated', data: { task } });
  } catch (err) {
    next(err);
  }
}

// Transition task status — only assignee or MANAGER/ADMIN can do this
async function transitionStatus(req, res, next) {
  try {
    const { status: newStatus } = req.body;
    const user = req.user;

    const task = await Task.findOne({ _id: req.params.id, organization: user.organization });
    if (!task) {
      return next(createError(404, 'NOT_FOUND', 'Task not found'));
    }

    // Only assignee or MANAGER/ADMIN can advance status
    const isAssignee = task.assignee.toString() === user._id.toString();
    const isManagerOrAdmin = ['MANAGER', 'ADMIN'].includes(user.role);

    if (!isAssignee && !isManagerOrAdmin) {
      return next(createError(403, 'FORBIDDEN', 'Only the assignee or a MANAGER/ADMIN can change task status'));
    }

    // Validate transition
    const validNextStatuses = Task.VALID_TRANSITIONS[task.status];
    if (!validNextStatuses.includes(newStatus)) {
      return next(
        createError(
          400,
          'INVALID_TRANSITION',
          `Cannot transition from ${task.status} to ${newStatus}. Valid transitions: ${validNextStatuses.join(', ') || 'none'}`
        )
      );
    }

    const oldStatus = task.status;
    task.status = newStatus;

    // Track completion time for analytics
    if (newStatus === 'DONE' && oldStatus !== 'DONE') {
      task.completedAt = new Date();
    }

    await task.save();
    await invalidateAssigneeCache(task.assignee.toString());

    res.json({
      status: 200,
      message: `Task moved from ${oldStatus} to ${newStatus}`,
      data: { task },
    });
  } catch (err) {
    next(err);
  }
}

// Delete Task — ADMIN only
async function deleteTask(req, res, next) {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, organization: req.user.organization });
    if (!task) {
      return next(createError(404, 'NOT_FOUND', 'Task not found'));
    }

    await invalidateAssigneeCache(task.assignee.toString());

    res.json({ status: 200, message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createTask, listTasks, getTask, updateTask, transitionStatus, deleteTask };
