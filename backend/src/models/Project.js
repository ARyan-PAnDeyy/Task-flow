const { DataTypes } = require('sequelize');
const { PROJECT_STATUS } = require('../config/constants');

module.exports = (sequelize) =>
  sequelize.define(
    'Project',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT },
      status: {
        type: DataTypes.ENUM(...Object.values(PROJECT_STATUS)),
        allowNull: false,
        defaultValue: PROJECT_STATUS.ACTIVE,
      },
      startDate: { type: DataTypes.DATEONLY },
      deadline: { type: DataTypes.DATEONLY },
      managerId: { type: DataTypes.INTEGER },
      createdById: { type: DataTypes.INTEGER },
    },
    { tableName: 'projects', indexes: [{ fields: ['manager_id'] }, { fields: ['status'] }] }
  );
