const mongoose = require('mongoose');

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

// Valid transitions map
const VALID_TRANSITIONS = {
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['DONE', 'BLOCKED'],
  DONE: [],
  BLOCKED: ['TODO', 'IN_PROGRESS'],
};

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'TODO',
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assignee is required'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organization: {
      type: String,
      required: true,
    },
    due_date: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes on frequently queried fields
taskSchema.index({ status: 1, organization: 1 });
taskSchema.index({ assignee: 1, organization: 1 });
taskSchema.index({ due_date: 1 });
taskSchema.index({ priority: 1, organization: 1 });

taskSchema.statics.VALID_TRANSITIONS = VALID_TRANSITIONS;
taskSchema.statics.STATUSES = STATUSES;
taskSchema.statics.PRIORITIES = PRIORITIES;

module.exports = mongoose.model('Task', taskSchema);
