const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const { Task, Project, User, Comment, Attachment } = require('../models');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const config = require('../config');
const { getPagination, paginated, getSort } = require('../utils/pagination');
const { searchWhere } = require('../utils/search');
const {
  accessibleProjectIds,
  loadProject,
  loadTask,
  canManageProject,
  assertAssignable,
} = require('../utils/access');
const { TASK_STATUS } = require('../config/constants');

const userAttrs = ['id', 'name', 'email', 'role'];
const today = () => new Date().toISOString().slice(0, 10);

async function fullTask(id) {
  const task = await Task.findByPk(id, {
    include: [
      { model: Project, as: 'project', attributes: ['id', 'name', 'managerId', 'status'] },
      { model: User, as: 'assignee', attributes: userAttrs },
      { model: User, as: 'createdBy', attributes: userAttrs },
    ],
  });
  const [commentCount, attachmentCount] = await Promise.all([
    Comment.count({ where: { taskId: id } }),
    Attachment.count({ where: { taskId: id } }),
  ]);
  return { ...task.toJSON(), commentCount, attachmentCount };
}

exports.list = async (req, res) => {
  const q = req.validatedQuery;
  const pg = getPagination(q);
  const where = { ...searchWhere(q.search, ['title', 'description']) };

  const ids = await accessibleProjectIds(req.user);
  if (ids !== null) where.projectId = { [Op.in]: ids };
  if (q.projectId) {
    if (ids !== null && !ids.includes(q.projectId)) throw ApiError.notFound('Project not found');
    where.projectId = q.projectId;
  }
  if (q.status) where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.assigneeId === 'me') where.assigneeId = req.user.id;
  else if (q.assigneeId === 'unassigned') where.assigneeId = null;
  else if (q.assigneeId) where.assigneeId = q.assigneeId;

  const due = {};
  if (q.dueBefore) due[Op.lte] = q.dueBefore.toISOString().slice(0, 10);
  if (q.dueAfter) due[Op.gte] = q.dueAfter.toISOString().slice(0, 10);
  if (q.overdue) {
    due[Op.lt] = today();
    where.status = { [Op.ne]: TASK_STATUS.COMPLETED };
  }
  if (Object.getOwnPropertySymbols(due).length) where.dueDate = due;

  const { rows, count } = await Task.findAndCountAll({
    where,
    include: [
      { model: Project, as: 'project', attributes: ['id', 'name'] },
      { model: User, as: 'assignee', attributes: userAttrs },
    ],
    order: getSort(q.sort, ['title', 'dueDate', 'priority', 'status', 'createdAt', 'updatedAt']),
    limit: pg.limit,
    offset: pg.offset,
    distinct: true,
  });
  res.json({ success: true, ...paginated(rows, count, pg) });
};

exports.get = async (req, res) => {
  const task = await loadTask(req.user, req.params.id);
  res.json({ success: true, data: await fullTask(task.id) });
};

exports.create = async (req, res) => {
  const project = await loadProject(req.user, req.body.projectId, { manage: true });
  await assertAssignable(project, req.body.assigneeId);

  const task = await Task.create({ ...req.body, createdById: req.user.id });
  await audit(req, 'CREATE', 'Task', task.id, {
    title: task.title,
    projectId: project.id,
    assigneeId: task.assigneeId,
  });
  res.status(201).json({ success: true, data: await fullTask(task.id) });
};

exports.update = async (req, res) => {
  const task = await loadTask(req.user, req.params.id);
  const manager = canManageProject(req.user, task.project);

  if (!manager) {
    // Assignees may only move their own task through the workflow.
    const onlyStatus = Object.keys(req.body).every((k) => k === 'status');
    if (task.assigneeId !== req.user.id || !onlyStatus) {
      throw ApiError.forbidden('Team members can only update the status of tasks assigned to them');
    }
  }
  if (req.body.assigneeId !== undefined) await assertAssignable(task.project, req.body.assigneeId);

  const before = task.toJSON();
  await task.update(req.body);
  const changes = Object.fromEntries(
    Object.keys(req.body).map((k) => [k, { from: before[k], to: task.get(k) }])
  );
  await audit(req, req.body.status && Object.keys(req.body).length === 1 ? 'STATUS_CHANGE' : 'UPDATE', 'Task', task.id, changes);
  res.json({ success: true, data: await fullTask(task.id) });
};

exports.remove = async (req, res) => {
  const task = await loadTask(req.user, req.params.id);
  if (!canManageProject(req.user, task.project)) {
    throw ApiError.forbidden('Only the project manager or an admin can delete tasks');
  }
  const attachments = await Attachment.findAll({ where: { taskId: task.id }, attributes: ['storedName'] });
  await task.destroy();
  await Promise.all(
    attachments.map((a) => fs.unlink(path.join(config.uploadDir, a.storedName)).catch(() => {}))
  );
  await audit(req, 'DELETE', 'Task', task.id, { title: task.title, projectId: task.projectId });
  res.json({ success: true, message: 'Task deleted' });
};

// ---------------- Comments ----------------

exports.listComments = async (req, res) => {
  const task = await loadTask(req.user, req.params.id);
  const comments = await Comment.findAll({
    where: { taskId: task.id },
    include: [{ model: User, as: 'author', attributes: userAttrs }],
    order: [['createdAt', 'ASC']],
  });
  res.json({ success: true, data: comments });
};

exports.addComment = async (req, res) => {
  const task = await loadTask(req.user, req.params.id);
  const comment = await Comment.create({ taskId: task.id, userId: req.user.id, content: req.body.content });
  await audit(req, 'COMMENT', 'Task', task.id, { commentId: comment.id });
  const data = await Comment.findByPk(comment.id, { include: [{ model: User, as: 'author', attributes: userAttrs }] });
  res.status(201).json({ success: true, data });
};

exports.deleteComment = async (req, res) => {
  const comment = await Comment.findByPk(req.params.id);
  if (!comment) throw ApiError.notFound('Comment not found');
  const task = await loadTask(req.user, comment.taskId);
  if (comment.userId !== req.user.id && !canManageProject(req.user, task.project)) {
    throw ApiError.forbidden('You can only delete your own comments');
  }
  await comment.destroy();
  await audit(req, 'DELETE_COMMENT', 'Task', task.id, { commentId: comment.id });
  res.json({ success: true, message: 'Comment deleted' });
};

// ---------------- Attachments ----------------

exports.listAttachments = async (req, res) => {
  const task = await loadTask(req.user, req.params.id);
  const attachments = await Attachment.findAll({
    where: { taskId: task.id },
    include: [{ model: User, as: 'uploadedBy', attributes: userAttrs }],
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: attachments });
};

exports.uploadAttachment = async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded (use multipart field "file")');
  let task;
  try {
    task = await loadTask(req.user, req.params.id);
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    throw err;
  }
  const attachment = await Attachment.create({
    taskId: task.id,
    uploadedById: req.user.id,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
  await audit(req, 'UPLOAD', 'Task', task.id, { attachmentId: attachment.id, file: attachment.originalName });
  res.status(201).json({ success: true, data: attachment });
};

exports.downloadAttachment = async (req, res) => {
  const attachment = await Attachment.findByPk(req.params.id);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  await loadTask(req.user, attachment.taskId);
  const filePath = path.join(config.uploadDir, attachment.storedName);
  try {
    await fs.access(filePath);
  } catch {
    throw ApiError.notFound('File is no longer available on the server');
  }
  res.download(filePath, attachment.originalName);
};

exports.deleteAttachment = async (req, res) => {
  const attachment = await Attachment.findByPk(req.params.id);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  const task = await loadTask(req.user, attachment.taskId);
  if (attachment.uploadedById !== req.user.id && !canManageProject(req.user, task.project)) {
    throw ApiError.forbidden('You can only delete your own attachments');
  }
  await attachment.destroy();
  await fs.unlink(path.join(config.uploadDir, attachment.storedName)).catch(() => {});
  await audit(req, 'DELETE_ATTACHMENT', 'Task', task.id, { attachmentId: attachment.id });
  res.json({ success: true, message: 'Attachment deleted' });
};
