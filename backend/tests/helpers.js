const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const { ROLES } = require('../src/config/constants');

const PASSWORD = 'Password@123';

/** Fresh in-memory DB with one user per role plus an extra member. */
async function setupDatabase() {
  await sequelize.sync({ force: true });
  const users = {
    admin: await User.create({ name: 'Admin', email: 'admin@test.com', password: PASSWORD, role: ROLES.ADMIN }),
    pm: await User.create({ name: 'Manager', email: 'pm@test.com', password: PASSWORD, role: ROLES.PROJECT_MANAGER }),
    pm2: await User.create({ name: 'Other Manager', email: 'pm2@test.com', password: PASSWORD, role: ROLES.PROJECT_MANAGER }),
    member: await User.create({ name: 'Member', email: 'member@test.com', password: PASSWORD, role: ROLES.TEAM_MEMBER }),
    outsider: await User.create({ name: 'Outsider', email: 'outsider@test.com', password: PASSWORD, role: ROLES.TEAM_MEMBER }),
  };
  const tokens = {};
  for (const [key, user] of Object.entries(users)) {
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    tokens[key] = res.body.data.token;
  }
  return { users, tokens };
}

/** Supertest agent bound to a bearer token: api(token).get('/api/...') */
const api = (token) => {
  const wrap = (method) => (url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), delete: wrap('delete') };
};

module.exports = { app, request, sequelize, setupDatabase, api, PASSWORD };
