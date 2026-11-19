const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { sequelize, User } = require('./models');
const { ROLES } = require('./config/constants');

/** Ensures at least one admin exists so the system is usable on first boot. */
async function ensureAdmin() {
  const admin = await User.findOne({ where: { role: ROLES.ADMIN } });
  if (admin) return;
  await User.create({ ...config.admin, role: ROLES.ADMIN });
  logger.info(`Seeded admin account: ${config.admin.email}`);
}

async function start() {
  try {
    await sequelize.authenticate();
    // Creates missing tables. For a schema change in production, use the SQL in docs/schema.sql
    // or add migrations; `alter` is intentionally not used to avoid destructive auto-changes.
    await sequelize.sync();
    if (process.env.SEED_DEMO === 'true' && (await User.count()) === 0) {
      await require('./seed').seedDemoData();
      logger.info('Empty database: demo data seeded (SEED_DEMO=true)');
    }
    await ensureAdmin();
    const server = app.listen(config.port, () => {
      logger.info(`API listening on http://localhost:${config.port} (${config.env}, ${sequelize.getDialect()})`);
      logger.info(`Swagger docs at http://localhost:${config.port}/api/docs`);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received, shutting down`);
      server.close(() => sequelize.close().then(() => process.exit(0)));
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
