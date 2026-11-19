/**
 * Central place for resource-level authorization rules.
 *
 *  ADMIN            -> full access to everything
 *  PROJECT_MANAGER  -> full control over projects they manage (and their tasks)
 *  TEAM_MEMBER      -> read access to projects they belong to; may update the
 *                      status of tasks assigned to them, comment and attach files
 */
const { Op } = require('sequelize');
const { Project, ProjectMember, Task } = require('../models');
const { ROLES } = require('../config/constants');
const ApiError = require('./ApiError');

const isAdmin = (user) => user.role === ROLES.ADMIN;

async function isProjectMember(userId, projectId) {
  const row = await ProjectMember.findOne({ where: { userId, projectId } });
  return Boolean(row);
}

/** IDs of every project the user may see (null = unrestricted). */
async function accessibleProjectIds(user) {
  if (isAdmin(user)) return null;
  const [memberships, managed] = await Promise.all([
    ProjectMember.findAll({ where: { userId: user.id }, attributes: ['projectId'], raw: true }),
    Project.findAll({ where: { managerId: user.id }, attributes: ['id'], raw: true }),
  ]);
  return [...new Set([...memberships.map((m) => m.projectId), ...managed.map((p) => p.id)])];
}

/** Sequelize where-fragment restricting a query on Project to accessible ones. */
async function projectScope(user) {
  const ids = await accessibleProjectIds(user);
  return ids === null ? {} : { id: { [Op.in]: ids } };
}

function canManageProject(user, project) {
  return isAdmin(user) || (user.role === ROLES.PROJECT_MANAGER && project.managerId === user.id);
}

async function canViewProject(user, project) {
  if (isAdmin(user) || project.managerId === user.id) return true;
  return isProjectMember(user.id, project.id);
}

/** Loads a project and asserts the user can view (or manage) it. */
async function loadProject(user, projectId, { manage = false } = {}) {
  const project = await Project.findByPk(projectId);
  if (!project) throw ApiError.notFound('Project not found');
  if (!(await canViewProject(user, project))) throw ApiError.notFound('Project not found');
  if (manage && !canManageProject(user, project)) {
    throw ApiError.forbidden('Only the project manager or an admin can do this');
  }
  return project;
}

/** Loads a task with its project and asserts the user can view it. */
async function loadTask(user, taskId) {
  const task = await Task.findByPk(taskId, { include: [{ model: Project, as: 'project' }] });
  if (!task) throw ApiError.notFound('Task not found');
  if (!(await canViewProject(user, task.project))) throw ApiError.notFound('Task not found');
  return task;
}

/** A user can be assigned a task only if they are on the project team. */
async function assertAssignable(project, userId) {
  if (userId === null || userId === undefined) return;
  if (project.managerId === userId) return;
  if (!(await isProjectMember(userId, project.id))) {
    throw ApiError.badRequest('Assignee must be a member of the project');
  }
}

module.exports = {
  isAdmin,
  isProjectMember,
  accessibleProjectIds,
  projectScope,
  canManageProject,
  canViewProject,
  loadProject,
  loadTask,
  assertAssignable,
};
