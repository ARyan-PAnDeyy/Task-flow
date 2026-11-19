const fs = require('fs/promises');
const path = require('path');
const { Op, fn, col } = require('sequelize');
const { sequelize, Project, ProjectMember, User, Task, Attachment } = require('../models');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const config = require('../config');
const { getPagination, paginated, getSort } = require('../utils/pagination');
const { searchWhere } = require('../utils/search');
const { projectScope, loadProject, isAdmin } = require('../utils/access');
const { ROLES, TASK_STATUS } = require('../config/constants');

const userAttrs = ['id', 'name', 'email', 'role'];

/** Returns { [projectId]: { total, completed, inProgress, todo, progress } }. */
async function taskStats(projectIds) {
  if (!projectIds.length) return {};
  const rows = await Task.findAll({
    where: { projectId: { [Op.in]: projectIds } },
    attributes: ['projectId', 'status', [fn('COUNT', col('id')), 'count']],
    group: ['projectId', 'status'],
    raw: true,
  });
  const stats = {};
  projectIds.forEach((pid) => {
    stats[pid] = { total: 0, todo: 0, inProgress: 0, completed: 0, progress: 0 };
  });
  rows.forEach((r) => {
    const s = stats[r.projectId];
    const n = Number(r.count);
    s.total += n;
    if (r.status === TASK_STATUS.TODO) s.todo += n;
    if (r.status === TASK_STATUS.IN_PROGRESS) s.inProgress += n;
    if (r.status === TASK_STATUS.COMPLETED) s.completed += n;
  });
  Object.values(stats).forEach((s) => {
    s.progress = s.total ? Math.round((s.completed / s.total) * 100) : 0;
  });
  return stats;
}

async function assertValidManager(managerId) {
  if (managerId === null || managerId === undefined) return;
  const manager = await User.findByPk(managerId);
  if (!manager || !manager.isActive) throw ApiError.badRequest('Manager not found or inactive');
  if (![ROLES.PROJECT_MANAGER, ROLES.ADMIN].includes(manager.role)) {
    throw ApiError.badRequest('Manager must have the PROJECT_MANAGER or ADMIN role');
  }
}

async function assertActiveUsers(userIds) {
  if (!userIds.length) return;
  const count = await User.count({ where: { id: { [Op.in]: userIds }, isActive: true } });
  if (count !== userIds.length) throw ApiError.badRequest('One or more users do not exist or are inactive');
}

async function fullProject(id) {
  const project = await Project.findByPk(id, {
    include: [
      { model: User, as: 'manager', attributes: userAttrs },
      { model: User, as: 'createdBy', attributes: userAttrs },
      { model: User, as: 'members', attributes: userAttrs, through: { attributes: ['joinedAt'] } },
    ],
    order: [[{ model: User, as: 'members' }, 'name', 'ASC']],
  });
  const stats = await taskStats([project.id]);
  return { ...project.toJSON(), stats: stats[project.id] };
}

exports.list = async (req, res) => {
  const q = req.validatedQuery;
  const pg = getPagination(q);
  const where = { ...(await projectScope(req.user)), ...searchWhere(q.search, ['name', 'description']) };
  if (q.status) where.status = q.status;
  if (q.managerId) where.managerId = q.managerId;

  const { rows, count } = await Project.findAndCountAll({
    where,
    include: [{ model: User, as: 'manager', attributes: userAttrs }],
    order: getSort(q.sort, ['name', 'deadline', 'createdAt', 'status']),
    limit: pg.limit,
    offset: pg.offset,
    distinct: true,
  });

  const ids = rows.map((p) => p.id);
  const [stats, memberCounts] = await Promise.all([
    taskStats(ids),
    ids.length
      ? ProjectMember.findAll({
          where: { projectId: { [Op.in]: ids } },
          attributes: ['projectId', [fn('COUNT', col('id')), 'count']],
          group: ['projectId'],
          raw: true,
        })
      : [],
  ]);
  const memberMap = Object.fromEntries(memberCounts.map((m) => [m.projectId, Number(m.count)]));
  const data = rows.map((p) => ({ ...p.toJSON(), stats: stats[p.id], memberCount: memberMap[p.id] || 0 }));

  res.json({ success: true, ...paginated(data, count, pg) });
};

exports.get = async (req, res) => {
  const project = await loadProject(req.user, req.params.id);
  res.json({ success: true, data: await fullProject(project.id) });
};

exports.create = async (req, res) => {
  const { memberIds, ...fields } = req.body;

  // A PM always manages the projects they create; an admin may pick any manager.
  if (req.user.role === ROLES.PROJECT_MANAGER) fields.managerId = req.user.id;
  else if (fields.managerId === undefined) fields.managerId = req.user.id;
  await assertValidManager(fields.managerId);
  await assertActiveUsers(memberIds);

  const project = await sequelize.transaction(async (transaction) => {
    const created = await Project.create({ ...fields, createdById: req.user.id }, { transaction });
    if (memberIds.length) {
      await ProjectMember.bulkCreate(
        memberIds.map((userId) => ({ projectId: created.id, userId })),
        { transaction }
      );
    }
    return created;
  });

  await audit(req, 'CREATE', 'Project', project.id, { name: project.name, memberIds });
  res.status(201).json({ success: true, data: await fullProject(project.id) });
};

exports.update = async (req, res) => {
  const project = await loadProject(req.user, req.params.id, { manage: true });

  if (req.body.managerId !== undefined && req.body.managerId !== project.managerId) {
    if (!isAdmin(req.user)) throw ApiError.forbidden('Only an admin can reassign the project manager');
    await assertValidManager(req.body.managerId);
  }

  const startDate = req.body.startDate !== undefined ? req.body.startDate : project.startDate;
  const deadline = req.body.deadline !== undefined ? req.body.deadline : project.deadline;
  if (startDate && deadline && new Date(deadline) < new Date(startDate)) {
    throw ApiError.badRequest('deadline must be on or after startDate');
  }

  const before = project.toJSON();
  await project.update(req.body);
  const changes = Object.fromEntries(
    Object.keys(req.body).map((k) => [k, { from: before[k], to: project.get(k) }])
  );
  await audit(req, 'UPDATE', 'Project', project.id, changes);
  res.json({ success: true, data: await fullProject(project.id) });
};

exports.remove = async (req, res) => {
  const project = await loadProject(req.user, req.params.id, { manage: true });

  const attachments = await Attachment.findAll({
    include: [{ model: Task, as: 'task', where: { projectId: project.id }, attributes: [] }],
    attributes: ['storedName'],
  });

  await sequelize.transaction(async (transaction) => {
    await ProjectMember.destroy({ where: { projectId: project.id }, transaction });
    await project.destroy({ transaction });
  });

  await Promise.all(
    attachments.map((a) => fs.unlink(path.join(config.uploadDir, a.storedName)).catch(() => {}))
  );
  await audit(req, 'DELETE', 'Project', project.id, { name: project.name });
  res.json({ success: true, message: 'Project deleted' });
};

exports.addMembers = async (req, res) => {
  const project = await loadProject(req.user, req.params.id, { manage: true });
  const { userIds } = req.body;
  await assertActiveUsers(userIds);

  const existing = await ProjectMember.findAll({
    where: { projectId: project.id, userId: { [Op.in]: userIds } },
    attributes: ['userId'],
    raw: true,
  });
  const existingIds = new Set(existing.map((e) => e.userId));
  const toAdd = userIds.filter((uid) => !existingIds.has(uid));
  if (toAdd.length) {
    await ProjectMember.bulkCreate(toAdd.map((userId) => ({ projectId: project.id, userId })));
  }

  await audit(req, 'ADD_MEMBERS', 'Project', project.id, { added: toAdd });
  res.json({ success: true, data: await fullProject(project.id) });
};

exports.removeMember = async (req, res) => {
  const project = await loadProject(req.user, req.params.id, { manage: true });
  const userId = Number(req.params.userId);
  const removed = await ProjectMember.destroy({ where: { projectId: project.id, userId } });
  if (!removed) throw ApiError.notFound('User is not a member of this project');

  // Their open tasks in this project become unassigned.
  await Task.update({ assigneeId: null }, { where: { projectId: project.id, assigneeId: userId } });

  await audit(req, 'REMOVE_MEMBER', 'Project', project.id, { userId });
  res.json({ success: true, data: await fullProject(project.id) });
};

exports.taskStats = taskStats;
