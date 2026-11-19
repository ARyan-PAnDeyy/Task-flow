const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'ProjectMember',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      tableName: 'project_members',
      updatedAt: false,
      createdAt: 'joinedAt',
      indexes: [{ unique: true, fields: ['project_id', 'user_id'] }],
    }
  );
