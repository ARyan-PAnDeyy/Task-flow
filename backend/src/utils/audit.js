const { AuditLog } = require('../models');
const logger = require('./logger');

/**
 * Records an audit trail entry. Never throws: an audit failure must not break
 * the business operation that triggered it.
 */
async function audit(req, action, entityType, entityId, details) {
  try {
    await AuditLog.create({
      userId: req.user ? req.user.id : null,
      action,
      entityType,
      entityId: entityId || null,
      details: details || null,
      ipAddress: req.ip,
    });
  } catch (err) {
    logger.error(`Failed to write audit log: ${err.message}`);
  }
}

module.exports = audit;
