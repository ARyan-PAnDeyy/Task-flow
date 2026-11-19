const { User, Project } = require('../models');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const { getPagination, paginated, getSort } = require('../utils/pagination');
const { searchWhere } = require('../utils/search');
const { ROLES } = require('../config/constants');

/** List users (admins & PMs - PMs need it to pick team members). */
exports.list = async (req, res) => {
  const q = req.validatedQuery;
  const pg = getPagination(q);
  const where = { ...searchWhere(q.search, ['name', 'email']) };
  if (q.role) where.role = q.role;
  if (q.isActive !== undefined) where.isActive = q.isActive;
  // Non-admins only ever see active users.
  if (req.user.role !== ROLES.ADMIN) where.isActive = true;

  const { rows, count } = await User.findAndCountAll({
    where,
    order: getSort(q.sort, ['name', 'email', 'role', 'createdAt'], [['name', 'ASC']]),
    limit: pg.limit,
    offset: pg.offset,
  });
  res.json({ success: true, ...paginated(rows, count, pg) });
};

exports.get = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: user });
};

/** Admin creates a user with any role. */
exports.create = async (req, res) => {
  if (await User.findOne({ where: { email: req.body.email.toLowerCase() } })) {
    throw ApiError.conflict('An account with this email already exists');
  }
  const user = await User.create(req.body);
  await audit(req, 'CREATE', 'User', user.id, { email: user.email, role: user.role });
  res.status(201).json({ success: true, data: user });
};

/** Admin updates a user's name, role or active flag. */
exports.update = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  if (user.id === req.user.id && (req.body.role && req.body.role !== ROLES.ADMIN)) {
    throw ApiError.badRequest('You cannot remove your own admin role');
  }
  if (user.id === req.user.id && req.body.isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  const before = { role: user.role, isActive: user.isActive, name: user.name };
  await user.update(req.body);

  // A demoted manager should no longer own projects.
  if (before.role === ROLES.PROJECT_MANAGER && user.role === ROLES.TEAM_MEMBER) {
    await Project.update({ managerId: null }, { where: { managerId: user.id } });
  }

  await audit(req, 'UPDATE', 'User', user.id, { before, after: req.body });
  res.json({ success: true, data: user });
};

/** Soft delete: deactivate instead of removing so history stays intact. */
exports.remove = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.id === req.user.id) throw ApiError.badRequest('You cannot deactivate your own account');
  await user.update({ isActive: false });
  await audit(req, 'DEACTIVATE', 'User', user.id);
  res.json({ success: true, message: 'User deactivated' });
};
