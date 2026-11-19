const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const v = require('../validators');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');
const h = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const projects = require('../controllers/projectController');
const tasks = require('../controllers/taskController');
const dashboard = require('../controllers/dashboardController');
const auditLogs = require('../controllers/auditController');

const { ADMIN, PROJECT_MANAGER } = ROLES;
const router = express.Router();

// Brute-force protection on credential endpoints (disabled in tests).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

// ---------- Auth ----------
router.post('/auth/register', authLimiter, validate(v.register), h(auth.register));
router.post('/auth/login', authLimiter, validate(v.login), h(auth.login));
router.get('/auth/me', authenticate, h(auth.me));
router.patch('/auth/me', authenticate, validate(v.updateProfile), h(auth.updateProfile));
router.post('/auth/change-password', authenticate, validate(v.changePassword), h(auth.changePassword));

// Everything below requires a valid token.
router.use(authenticate);

// ---------- Users ----------
router.get('/users', authorize(ADMIN, PROJECT_MANAGER), validate(v.userList, 'query'), h(users.list));
router.post('/users', authorize(ADMIN), validate(v.createUser), h(users.create));
router.get('/users/:id', authorize(ADMIN, PROJECT_MANAGER), validate(v.idParam, 'params'), h(users.get));
router.patch('/users/:id', authorize(ADMIN), validate(v.idParam, 'params'), validate(v.updateUser), h(users.update));
router.delete('/users/:id', authorize(ADMIN), validate(v.idParam, 'params'), h(users.remove));

// ---------- Projects ----------
router.get('/projects', validate(v.projectList, 'query'), h(projects.list));
router.post('/projects', authorize(ADMIN, PROJECT_MANAGER), validate(v.createProject), h(projects.create));
router.get('/projects/:id', validate(v.idParam, 'params'), h(projects.get));
router.patch('/projects/:id', validate(v.idParam, 'params'), validate(v.updateProject), h(projects.update));
router.delete('/projects/:id', validate(v.idParam, 'params'), h(projects.remove));
router.post('/projects/:id/members', validate(v.idParam, 'params'), validate(v.addMembers), h(projects.addMembers));
router.delete('/projects/:id/members/:userId', validate(v.memberParams, 'params'), h(projects.removeMember));

// ---------- Tasks ----------
router.get('/tasks', validate(v.taskList, 'query'), h(tasks.list));
router.post('/tasks', validate(v.createTask), h(tasks.create));
router.get('/tasks/:id', validate(v.idParam, 'params'), h(tasks.get));
router.patch('/tasks/:id', validate(v.idParam, 'params'), validate(v.updateTask), h(tasks.update));
router.delete('/tasks/:id', validate(v.idParam, 'params'), h(tasks.remove));

// ---------- Comments ----------
router.get('/tasks/:id/comments', validate(v.idParam, 'params'), h(tasks.listComments));
router.post('/tasks/:id/comments', validate(v.idParam, 'params'), validate(v.createComment), h(tasks.addComment));
router.delete('/comments/:id', validate(v.idParam, 'params'), h(tasks.deleteComment));

// ---------- Attachments ----------
router.get('/tasks/:id/attachments', validate(v.idParam, 'params'), h(tasks.listAttachments));
router.post('/tasks/:id/attachments', validate(v.idParam, 'params'), upload.single('file'), h(tasks.uploadAttachment));
router.get('/attachments/:id/download', validate(v.idParam, 'params'), h(tasks.downloadAttachment));
router.delete('/attachments/:id', validate(v.idParam, 'params'), h(tasks.deleteAttachment));

// ---------- Dashboard & audit ----------
router.get('/dashboard', h(dashboard.overview));
router.get('/audit-logs', authorize(ADMIN), validate(v.auditList, 'query'), h(auditLogs.list));

module.exports = router;
