const Task = require('../models/Task');

// Bonus: Analytics — overdue count per user + avg completion time
async function getAnalytics(req, res, next) {
  try {
    const org = req.user.organization;
    const now = new Date();

    // Overdue tasks (not DONE and past due_date)
    const overdueStats = await Task.aggregate([
      {
        $match: {
          organization: org,
          due_date: { $lt: now },
          status: { $nin: ['DONE'] },
        },
      },
      {
        $group: {
          _id: '$assignee',
          overdueCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          email: '$user.email',
          overdueCount: 1,
        },
      },
      { $sort: { overdueCount: -1 } },
    ]);

    // Average completion time per user (createdAt → completedAt for DONE tasks)
    const completionStats = await Task.aggregate([
      {
        $match: {
          organization: org,
          status: 'DONE',
          completedAt: { $exists: true },
        },
      },
      {
        $project: {
          assignee: 1,
          durationHours: {
            $divide: [
              { $subtract: ['$completedAt', '$createdAt'] },
              1000 * 60 * 60, // ms → hours
            ],
          },
        },
      },
      {
        $group: {
          _id: '$assignee',
          avgCompletionHours: { $avg: '$durationHours' },
          completedTaskCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          email: '$user.email',
          avgCompletionHours: { $round: ['$avgCompletionHours', 2] },
          completedTaskCount: 1,
        },
      },
      { $sort: { avgCompletionHours: 1 } },
    ]);

    // Summary counts
    const summary = await Task.aggregate([
      { $match: { organization: org } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusSummary = summary.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    res.json({
      status: 200,
      data: {
        overduePerUser: overdueStats,
        avgCompletionPerUser: completionStats,
        statusSummary,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAnalytics };
