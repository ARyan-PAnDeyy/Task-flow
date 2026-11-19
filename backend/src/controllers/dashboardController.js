const { Op, fn, col } = require('sequelize');
const { Task, Project, User } = require('../models');
const { accessibleProjectIds } = require('../utils/access');
const { taskStats } = require('./projectController');
const { TASK_STATUS, TASK_PRIORITY, PROJECT_STATUS } = require('../config/constants');

const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

/**
 * GET /api/dashboard
 * Everything the dashboard needs in one round-trip, scoped to the projects
 * the current user can see.
 */
exports.overview = async (req, res) => {
  const ids = await accessibleProjectIds(req.user);
  const projectWhere = ids === null ? {} : { id: { [Op.in]: ids } };
  const taskWhere = ids === null ? {} : { projectId: { [Op.in]: ids } };
  const now = new Date();
  const today = isoDay(now);
  const open = { [Op.ne]: TASK_STATUS.COMPLETED };

  const [
    projectCount,
    activeProjects,
    statusRows,
    priorityRows,
    overdue,
    myOpenTasks,
    upcomingTasks,
    upcomingProjects,
    perfRows,
    overdueByUser,
  ] = await Promise.all([
    Project.count({ where: projectWhere }),
    Project.count({ where: { ...projectWhere, status: PROJECT_STATUS.ACTIVE } }),
    Task.findAll({ where: taskWhere, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
    Task.findAll({ where: taskWhere, attributes: ['priority', [fn('COUNT', col('id')), 'count']], group: ['priority'], raw: true }),
    Task.count({ where: { ...taskWhere, status: open, dueDate: { [Op.lt]: today } } }),
    Task.count({ where: { ...taskWhere, status: open, assigneeId: req.user.id } }),
    Task.findAll({
      where: { ...taskWhere, status: open, dueDate: { [Op.between]: [today, isoDay(addDays(now, 14))] } },
      include: [
        { model: Project, as: 'project', attributes: ['id', 'name'] },
        { model: User, as: 'assignee', attributes: ['id', 'name'] },
      ],
      order: [['dueDate', 'ASC']],
      limit: 8,
    }),
    Project.findAll({
      where: {
        ...projectWhere,
        status: { [Op.ne]: PROJECT_STATUS.COMPLETED },
        deadline: { [Op.between]: [today, isoDay(addDays(now, 30))] },
      },
      attributes: ['id', 'name', 'deadline', 'status'],
      order: [['deadline', 'ASC']],
      limit: 5,
    }),
    Task.findAll({
      where: { ...taskWhere, assigneeId: { [Op.ne]: null } },
      attributes: ['assigneeId', 'status', [fn('COUNT', col('id')), 'count']],
      group: ['assigneeId', 'status'],
      raw: true,
    }),
    Task.findAll({
      where: { ...taskWhere, assigneeId: { [Op.ne]: null }, status: open, dueDate: { [Op.lt]: today } },
      attributes: ['assigneeId', [fn('COUNT', col('id')), 'count']],
      group: ['assigneeId'],
      raw: true,
    }),
  ]);

  // ---- Status / priority breakdown
  const byStatus = Object.fromEntries(Object.values(TASK_STATUS).map((s) => [s, 0]));
  statusRows.forEach((r) => { byStatus[r.status] = Number(r.count); });
  const byPriority = Object.fromEntries(Object.values(TASK_PRIORITY).map((p) => [p, 0]));
  priorityRows.forEach((r) => { byPriority[r.priority] = Number(r.count); });
  const totalTasks = Object.values(byStatus).reduce((a, b) => a + b, 0);

  // ---- Project progress (most urgent first)
  const projects = await Project.findAll({
    where: { ...projectWhere, status: { [Op.ne]: PROJECT_STATUS.COMPLETED } },
    attributes: ['id', 'name', 'deadline', 'status'],
    order: [['deadline', 'ASC'], ['createdAt', 'DESC']],
    limit: 8,
  });
  const stats = await taskStats(projects.map((p) => p.id));
  const projectProgress = projects.map((p) => ({ ...p.toJSON(), ...stats[p.id] }));

  // ---- Completed vs created, last 14 days
  const since = addDays(now, -13);
  since.setUTCHours(0, 0, 0, 0);
  const [created, completed] = await Promise.all([
    Task.findAll({ where: { ...taskWhere, createdAt: { [Op.gte]: since } }, attributes: ['createdAt'], raw: true }),
    Task.findAll({ where: { ...taskWhere, completedAt: { [Op.gte]: since } }, attributes: ['completedAt'], raw: true }),
  ]);
  const trend = [];
  for (let i = 0; i < 14; i += 1) trend.push({ date: isoDay(addDays(since, i)), created: 0, completed: 0 });
  const bucket = Object.fromEntries(trend.map((t) => [t.date, t]));
  created.forEach((t) => { const b = bucket[isoDay(new Date(t.createdAt))]; if (b) b.created += 1; });
  completed.forEach((t) => { const b = bucket[isoDay(new Date(t.completedAt))]; if (b) b.completed += 1; });

  // ---- Team performance
  const perf = {};
  perfRows.forEach((r) => {
    perf[r.assigneeId] = perf[r.assigneeId] || { assigned: 0, completed: 0, inProgress: 0, todo: 0, overdue: 0 };
    const n = Number(r.count);
    perf[r.assigneeId].assigned += n;
    if (r.status === TASK_STATUS.COMPLETED) perf[r.assigneeId].completed += n;
    if (r.status === TASK_STATUS.IN_PROGRESS) perf[r.assigneeId].inProgress += n;
    if (r.status === TASK_STATUS.TODO) perf[r.assigneeId].todo += n;
  });
  overdueByUser.forEach((r) => { if (perf[r.assigneeId]) perf[r.assigneeId].overdue = Number(r.count); });
  const users = await User.findAll({ where: { id: { [Op.in]: Object.keys(perf).map(Number) } }, attributes: ['id', 'name', 'role'] });
  const teamPerformance = users
    .map((u) => {
      const p = perf[u.id];
      return { user: u, ...p, completionRate: p.assigned ? Math.round((p.completed / p.assigned) * 100) : 0 };
    })
    .sort((a, b) => b.completed - a.completed || b.completionRate - a.completionRate);

  res.json({
    success: true,
    data: {
      summary: {
        totalProjects: projectCount,
        activeProjects,
        totalTasks,
        completedTasks: byStatus.COMPLETED,
        pendingTasks: totalTasks - byStatus.COMPLETED,
        overdueTasks: overdue,
        myOpenTasks,
        completionRate: totalTasks ? Math.round((byStatus.COMPLETED / totalTasks) * 100) : 0,
      },
      tasksByStatus: byStatus,
      tasksByPriority: byPriority,
      projectProgress,
      upcomingDeadlines: { tasks: upcomingTasks, projects: upcomingProjects },
      completionTrend: trend,
      teamPerformance,
    },
  });
};
