const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'Attachment',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      originalName: { type: DataTypes.STRING, allowNull: false },
      storedName: { type: DataTypes.STRING, allowNull: false },
      mimeType: { type: DataTypes.STRING(100), allowNull: false },
      size: { type: DataTypes.INTEGER, allowNull: false },
      taskId: { type: DataTypes.INTEGER, allowNull: false },
      uploadedById: { type: DataTypes.INTEGER },
    },
    { tableName: 'attachments', updatedAt: false, indexes: [{ fields: ['task_id'] }] }
  );
