const Joi = require('joi');
const { ROLES, TASK_STATUS, TASK_PRIORITY, PROJECT_STATUS } = require('../config/constants');

const id = Joi.number().integer().positive();
const date = Joi.date().iso();
const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[a-z]/, 'lowercase letter')
  .pattern(/[0-9]/, 'number')
  .messages({ 'string.pattern.name': 'Password must contain at least one {#name}' });

const listQuery = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow(''),
  sort: Joi.string().trim().max(50),
};

const idParam = Joi.object({ id: id.required() });

// ---------- Auth ----------
const register = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().max(150).required(),
  password: password.required(),
});

const login = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required(),
});

const changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: password.required(),
});

const updateProfile = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
});

// ---------- Users ----------
const userList = Joi.object({
  ...listQuery,
  role: Joi.string().valid(...Object.values(ROLES)),
  isActive: Joi.boolean(),
});

const createUser = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().max(150).required(),
  password: password.required(),
  role: Joi.string().valid(...Object.values(ROLES)).default(ROLES.TEAM_MEMBER),
});

const updateUser = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  role: Joi.string().valid(...Object.values(ROLES)),
  isActive: Joi.boolean(),
}).min(1);

// ---------- Projects ----------
const projectBase = {
  name: Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().max(5000).allow('', null),
  status: Joi.string().valid(...Object.values(PROJECT_STATUS)),
  startDate: date.allow(null),
  deadline: date.allow(null),
  managerId: id.allow(null),
};

const deadlineAfterStart = (value, helpers) => {
  if (value.startDate && value.deadline && new Date(value.deadline) < new Date(value.startDate)) {
    return helpers.message('deadline must be on or after startDate');
  }
  return value;
};

const createProject = Joi.object({
  ...projectBase,
  name: projectBase.name.required(),
  memberIds: Joi.array().items(id).unique().default([]),
}).custom(deadlineAfterStart);

const updateProject = Joi.object(projectBase).min(1).custom(deadlineAfterStart);

const projectList = Joi.object({
  ...listQuery,
  status: Joi.string().valid(...Object.values(PROJECT_STATUS)),
  managerId: id,
});

const addMembers = Joi.object({
  userIds: Joi.array().items(id).min(1).unique().required(),
});

const memberParams = Joi.object({ id: id.required(), userId: id.required() });

// ---------- Tasks ----------
const taskBase = {
  title: Joi.string().trim().min(2).max(200),
  description: Joi.string().trim().max(10000).allow('', null),
  status: Joi.string().valid(...Object.values(TASK_STATUS)),
  priority: Joi.string().valid(...Object.values(TASK_PRIORITY)),
  dueDate: date.allow(null),
  assigneeId: id.allow(null),
};

const createTask = Joi.object({
  ...taskBase,
  title: taskBase.title.required(),
  projectId: id.required(),
});

const updateTask = Joi.object(taskBase).min(1);

const taskList = Joi.object({
  ...listQuery,
  projectId: id,
  status: Joi.string().valid(...Object.values(TASK_STATUS)),
  priority: Joi.string().valid(...Object.values(TASK_PRIORITY)),
  assigneeId: Joi.alternatives().try(id, Joi.string().valid('me', 'unassigned')),
  dueBefore: date,
  dueAfter: date,
  overdue: Joi.boolean(),
});

// ---------- Comments ----------
const createComment = Joi.object({
  content: Joi.string().trim().min(1).max(5000).required(),
});

// ---------- Audit ----------
const auditList = Joi.object({
  page: listQuery.page,
  limit: listQuery.limit,
  action: Joi.string().trim().max(50),
  entityType: Joi.string().trim().max(50),
  userId: id,
  from: date,
  to: date,
});

module.exports = {
  idParam,
  register,
  login,
  changePassword,
  updateProfile,
  userList,
  createUser,
  updateUser,
  createProject,
  updateProject,
  projectList,
  addMembers,
  memberParams,
  createTask,
  updateTask,
  taskList,
  createComment,
  auditList,
};
