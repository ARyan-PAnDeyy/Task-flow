const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER },
      action: { type: DataTypes.STRING(50), allowNull: false },
      entityType: { type: DataTypes.STRING(50), allowNull: false },
      entityId: { type: DataTypes.INTEGER },
      details: { type: DataTypes.JSON },
      ipAddress: { type: DataTypes.STRING(64) },
    },
    {
      tableName: 'audit_logs',
      updatedAt: false,
      indexes: [{ fields: ['entity_type', 'entity_id'] }, { fields: ['user_id'] }, { fields: ['created_at'] }],
    }
  );
