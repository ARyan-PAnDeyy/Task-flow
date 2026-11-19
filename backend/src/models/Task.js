const { DataTypes } = require('sequelize');
const { TASK_STATUS, TASK_PRIORITY } = require('../config/constants');

module.exports = (sequelize) =>
  sequelize.define(
    'Task',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT },
      status: {
        type: DataTypes.ENUM(...Object.values(TASK_STATUS)),
        allowNull: false,
        defaultValue: TASK_STATUS.TODO,
      },
      priority: {
        type: DataTypes.ENUM(...Object.values(TASK_PRIORITY)),
        allowNull: false,
        defaultValue: TASK_PRIORITY.MEDIUM,
      },
      dueDate: { type: DataTypes.DATEONLY },
      completedAt: { type: DataTypes.DATE },
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      assigneeId: { type: DataTypes.INTEGER },
      createdById: { type: DataTypes.INTEGER },
    },
    {
      tableName: 'tasks',
      indexes: [
        { fields: ['project_id'] },
        { fields: ['assignee_id'] },
        { fields: ['status'] },
        { fields: ['due_date'] },
      ],
      hooks: {
        beforeSave(task) {
          if (task.isNewRecord || task.changed('status')) {
            task.completedAt = task.status === TASK_STATUS.COMPLETED ? new Date() : null;
          }
        },
      },
    }
  );
