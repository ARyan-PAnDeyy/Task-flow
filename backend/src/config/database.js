const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const config = require('./index');

function createSequelize() {
  const common = { logging: false, define: { underscored: true, timestamps: true } };

  if (config.db.dialect === 'postgres') {
    const dialectOptions = config.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {};
    if (config.db.url) {
      return new Sequelize(config.db.url, { ...common, dialect: 'postgres', dialectOptions });
    }
    return new Sequelize(config.db.name, config.db.user, config.db.password, {
      ...common,
      host: config.db.host,
      port: config.db.port,
      dialect: 'postgres',
      dialectOptions,
    });
  }

  if (config.db.storage !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(config.db.storage)), { recursive: true });
  }
  return new Sequelize({ ...common, dialect: 'sqlite', storage: config.db.storage });
}

module.exports = createSequelize();
