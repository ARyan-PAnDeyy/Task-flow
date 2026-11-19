const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isTest: env === 'test',
  isProd: env === 'production',
  port: parseInt(process.env.PORT, 10) || 5000,
  db: {
    dialect: env === 'test' ? 'sqlite' : process.env.DB_DIALECT || 'sqlite',
    storage: env === 'test' ? ':memory:' : process.env.SQLITE_STORAGE || './data/dev.sqlite',
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'taskflow',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  bcryptRounds: env === 'test' ? 4 : parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  uploadDir: env === 'test' ? path.join(require('os').tmpdir(), 'taskflow-test-uploads') : path.resolve(process.env.UPLOAD_DIR || './uploads'),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
  admin: {
    name: process.env.ADMIN_NAME || 'System Admin',
    email: process.env.ADMIN_EMAIL || 'admin@taskflow.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  },
};

if (config.isProd && config.jwt.secret === 'dev-only-insecure-secret') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
