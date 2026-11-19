const { User } = require('../models');
const { signToken } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const { ROLES } = require('../config/constants');

/** Public self-registration. New accounts are always TEAM_MEMBERs; an admin can promote them. */
exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.findOne({ where: { email: email.toLowerCase() } })) {
    throw ApiError.conflict('An account with this email already exists');
  }
  const user = await User.create({ name, email, password, role: ROLES.TEAM_MEMBER });
  req.user = user;
  await audit(req, 'REGISTER', 'User', user.id);
  res.status(201).json({ success: true, data: { user, token: signToken(user) } });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.scope('withPassword').findOne({ where: { email: email.toLowerCase() } });

  // Same message for unknown email and wrong password to avoid user enumeration.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  user.lastLoginAt = new Date();
  await user.save();
  req.user = user;
  await audit(req, 'LOGIN', 'User', user.id);
  res.json({ success: true, data: { user, token: signToken(user) } });
};

exports.me = async (req, res) => {
  res.json({ success: true, data: req.user });
};

exports.updateProfile = async (req, res) => {
  req.user.name = req.body.name;
  await req.user.save();
  await audit(req, 'UPDATE_PROFILE', 'User', req.user.id);
  res.json({ success: true, data: req.user });
};

exports.changePassword = async (req, res) => {
  const user = await User.scope('withPassword').findByPk(req.user.id);
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect');
  }
  user.password = req.body.newPassword;
  await user.save();
  await audit(req, 'CHANGE_PASSWORD', 'User', user.id);
  res.json({ success: true, message: 'Password updated successfully' });
};
