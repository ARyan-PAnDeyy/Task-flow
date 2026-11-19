const sequelize = require('../config/database');

const User = require('./User')(sequelize);
const Project = require('./Project')(sequelize);
const ProjectMember = require('./ProjectMember')(sequelize);
const Task = require('./Task')(sequelize);
const Comment = require('./Comment')(sequelize);
const Attachment = require('./Attachment')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);

// Project <-> User (manager / creator)
Project.belongsTo(User, { as: 'manager', foreignKey: 'managerId', onDelete: 'SET NULL' });
Project.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' });
User.hasMany(Project, { as: 'managedProjects', foreignKey: 'managerId' });

// Project <-> User (team members, many-to-many through project_members)
Project.belongsToMany(User, { as: 'members', through: ProjectMember, foreignKey: 'projectId', otherKey: 'userId' });
User.belongsToMany(Project, { as: 'projects', through: ProjectMember, foreignKey: 'userId', otherKey: 'projectId' });

// Project -> Tasks
Project.hasMany(Task, { as: 'tasks', foreignKey: 'projectId', onDelete: 'CASCADE', hooks: true });
Task.belongsTo(Project, { as: 'project', foreignKey: 'projectId' });
Task.belongsTo(User, { as: 'assignee', foreignKey: 'assigneeId', onDelete: 'SET NULL' });
Task.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' });
User.hasMany(Task, { as: 'assignedTasks', foreignKey: 'assigneeId' });

// Task -> Comments / Attachments
Task.hasMany(Comment, { as: 'comments', foreignKey: 'taskId', onDelete: 'CASCADE', hooks: true });
Comment.belongsTo(Task, { as: 'task', foreignKey: 'taskId' });
Comment.belongsTo(User, { as: 'author', foreignKey: 'userId', onDelete: 'SET NULL' });

Task.hasMany(Attachment, { as: 'attachments', foreignKey: 'taskId', onDelete: 'CASCADE', hooks: true });
Attachment.belongsTo(Task, { as: 'task', foreignKey: 'taskId' });
Attachment.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedById', onDelete: 'SET NULL' });

AuditLog.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'SET NULL' });

module.exports = { sequelize, User, Project, ProjectMember, Task, Comment, Attachment, AuditLog };
