/* eslint-disable no-console */
/**
 * Resets the database and loads realistic demo data.
 *   npm run seed
 * All demo accounts use the password: Password@123 (admin uses ADMIN_PASSWORD from .env)
 */
const config = require('./config');
const { sequelize, User, Project, ProjectMember, Task, Comment, AuditLog } = require('./models');
const { ROLES, TASK_STATUS: S, TASK_PRIORITY: P, PROJECT_STATUS } = require('./config/constants');

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ago = (days) => new Date(Date.now() - days * 86400000);

/** Inserts demo users/projects/tasks. Expects empty, already-synced tables. */
async function seedDemoData() {
  const pw = 'Password@123';
  const admin = await User.create({ ...config.admin, role: ROLES.ADMIN });
  const [priya, rahul] = await Promise.all([
    User.create({ name: 'Priya Sharma', email: 'priya.pm@taskflow.com', password: pw, role: ROLES.PROJECT_MANAGER }),
    User.create({ name: 'Rahul Verma', email: 'rahul.pm@taskflow.com', password: pw, role: ROLES.PROJECT_MANAGER }),
  ]);
  const members = await Promise.all(
    [
      ['Ananya Gupta', 'ananya@taskflow.com'],
      ['Vikram Singh', 'vikram@taskflow.com'],
      ['Sneha Patel', 'sneha@taskflow.com'],
      ['Arjun Mehta', 'arjun@taskflow.com'],
      ['Kavya Nair', 'kavya@taskflow.com'],
    ].map(([name, email]) => User.create({ name, email, password: pw, role: ROLES.TEAM_MEMBER }))
  );
  const [ananya, vikram, sneha, arjun, kavya] = members;

  const projects = [
    {
      data: { name: 'E-Commerce Platform Revamp', description: 'Rebuild the storefront with a modern stack, faster checkout and improved SEO.', status: PROJECT_STATUS.ACTIVE, startDate: day(-30), deadline: day(25), managerId: priya.id },
      team: [ananya, vikram, sneha],
      tasks: [
        ['Design new product listing page', P.HIGH, S.COMPLETED, -10, ananya, 9],
        ['Implement cart service API', P.HIGH, S.COMPLETED, -5, vikram, 6],
        ['Integrate payment gateway', P.HIGH, S.IN_PROGRESS, 3, vikram],
        ['Write checkout E2E tests', P.MEDIUM, S.TODO, 10, sneha],
        ['Optimize image delivery via CDN', P.MEDIUM, S.IN_PROGRESS, 6, ananya],
        ['SEO meta tags for product pages', P.LOW, S.TODO, 15, sneha],
        ['Migrate legacy orders table', P.HIGH, S.TODO, -2, vikram],
        ['Accessibility audit (WCAG 2.1)', P.MEDIUM, S.COMPLETED, -3, sneha, 2],
      ],
    },
    {
      data: { name: 'Mobile App v2.0', description: 'Second major release of the customer mobile app with offline mode and push notifications.', status: PROJECT_STATUS.ACTIVE, startDate: day(-20), deadline: day(40), managerId: rahul.id },
      team: [arjun, kavya, ananya],
      tasks: [
        ['Set up React Native project structure', P.HIGH, S.COMPLETED, -15, arjun, 12],
        ['Implement offline sync engine', P.HIGH, S.IN_PROGRESS, 8, arjun],
        ['Push notification service', P.MEDIUM, S.TODO, 12, kavya],
        ['Redesign onboarding screens', P.MEDIUM, S.COMPLETED, -4, ananya, 4],
        ['Biometric login support', P.LOW, S.TODO, 20, kavya],
        ['Crash reporting integration', P.MEDIUM, S.COMPLETED, -1, kavya, 1],
        ['Beta release to internal testers', P.HIGH, S.TODO, 2, null],
      ],
    },
    {
      data: { name: 'Internal HR Portal', description: 'Self-service portal for leave requests, payslips and employee directory.', status: PROJECT_STATUS.PLANNING, startDate: day(5), deadline: day(75), managerId: priya.id },
      team: [kavya, sneha],
      tasks: [
        ['Gather requirements from HR team', P.HIGH, S.IN_PROGRESS, 4, sneha],
        ['Draft database schema', P.MEDIUM, S.TODO, 9, kavya],
        ['Create UI wireframes', P.MEDIUM, S.TODO, 12, sneha],
      ],
    },
    {
      data: { name: 'Data Warehouse Migration', description: 'Move analytics workloads from on-prem to a cloud warehouse.', status: PROJECT_STATUS.COMPLETED, startDate: day(-90), deadline: day(-7), managerId: rahul.id },
      team: [vikram, arjun],
      tasks: [
        ['Inventory existing ETL jobs', P.MEDIUM, S.COMPLETED, -60, vikram, 13],
        ['Provision cloud warehouse', P.HIGH, S.COMPLETED, -45, arjun, 11],
        ['Migrate reporting dashboards', P.HIGH, S.COMPLETED, -10, vikram, 8],
        ['Decommission old servers', P.LOW, S.COMPLETED, -7, arjun, 7],
      ],
    },
  ];

  const commentPool = [
    'Started working on this, will share an update by EOD.',
    'Blocked on API credentials - can someone help?',
    'PR is up for review.',
    'Looks good to me, merging.',
    'Can we push the due date by two days?',
    'Added screenshots in the attachments.',
  ];

  let ci = 0;
  for (const proj of projects) {
    const project = await Project.create({ ...proj.data, createdById: proj.data.managerId });
    await ProjectMember.bulkCreate(proj.team.map((u) => ({ projectId: project.id, userId: u.id })));
    for (const [title, priority, status, due, assignee, completedDaysAgo] of proj.tasks) {
      const task = await Task.create({
        title,
        description: `${title}. Acceptance criteria and notes are tracked in the comments below.`,
        priority,
        status,
        dueDate: day(due),
        projectId: project.id,
        assigneeId: assignee ? assignee.id : null,
        createdById: proj.data.managerId,
      });
      // Back-date timestamps so the dashboard trend chart has history.
      const createdAt = ago(Math.max((completedDaysAgo || 0) + 3, Math.floor(Math.random() * 13)));
      await Task.update(
        { completedAt: completedDaysAgo !== undefined ? ago(completedDaysAgo) : null },
        { where: { id: task.id }, hooks: false, silent: true }
      );
      await sequelize.query('UPDATE tasks SET created_at = :createdAt WHERE id = :id', {
        replacements: { createdAt, id: task.id },
      });
      if (assignee && ci % 2 === 0) {
        await Comment.create({ taskId: task.id, userId: assignee.id, content: commentPool[ci % commentPool.length] });
        await Comment.create({ taskId: task.id, userId: proj.data.managerId, content: commentPool[(ci + 3) % commentPool.length] });
      }
      ci += 1;
    }
  }

  await AuditLog.create({ userId: admin.id, action: 'SEED', entityType: 'System', details: { note: 'Demo data loaded' } });
}

async function runCli() {
  await sequelize.sync({ force: true });
  await seedDemoData();
  const pw = 'Password@123';
  console.log('\nSeed complete. Demo accounts:');
  console.table([
    { role: 'ADMIN', email: config.admin.email, password: config.admin.password },
    { role: 'PROJECT_MANAGER', email: 'priya.pm@taskflow.com', password: pw },
    { role: 'PROJECT_MANAGER', email: 'rahul.pm@taskflow.com', password: pw },
    { role: 'TEAM_MEMBER', email: 'ananya@taskflow.com', password: pw },
    { role: 'TEAM_MEMBER', email: 'vikram@taskflow.com (+ sneha, arjun, kavya)', password: pw },
  ]);
  await sequelize.close();
}

module.exports = { seedDemoData };

if (require.main === module) {
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
