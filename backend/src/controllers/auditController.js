const { Op } = require('sequelize');
const { AuditLog, User } = require('../models');
const { getPagination, paginated } = require('../utils/pagination');

exports.list = async (req, res) => {
  const q = req.validatedQuery;
  const pg = getPagination(q);
  const where = {};
  if (q.action) where.action = q.action;
  if (q.entityType) where.entityType = q.entityType;
  if (q.userId) where.userId = q.userId;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt[Op.gte] = q.from;
    if (q.to) where.createdAt[Op.lte] = q.to;
  }

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: pg.limit,
    offset: pg.offset,
  });
  res.json({ success: true, ...paginated(rows, count, pg) });
};
