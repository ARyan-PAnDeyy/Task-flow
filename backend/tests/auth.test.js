const { app, request, sequelize, setupDatabase, api, PASSWORD } = require('./helpers');
const { User } = require('../src/models');

let ctx;
beforeAll(async () => {
  ctx = await setupDatabase();
});
afterAll(() => sequelize.close());

describe('POST /api/auth/register', () => {
  it('registers a new user as TEAM_MEMBER and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'New@Test.com', password: 'Secret@123', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('TEAM_MEMBER'); // role in body is ignored
    expect(res.body.data.user.email).toBe('new@test.com');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('stores a bcrypt hash, never the plain password', async () => {
    const user = await User.scope('withPassword').findOne({ where: { email: 'new@test.com' } });
    expect(user.password).not.toBe('Secret@123');
    expect(user.password).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate emails with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'new@test.com', password: 'Secret@123' });
    expect(res.status).toBe(409);
  });

  it('validates input and reports every invalid field', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: 'weak' });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'pm@test.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('PROJECT_MANAGER');
  });

  it('rejects a wrong password with a generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'pm@test.com', password: 'Wrong@123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects deactivated accounts', async () => {
    await User.create({ name: 'Gone', email: 'gone@test.com', password: PASSWORD, isActive: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'gone@test.com', password: PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('JWT protection', () => {
  it('returns the current user for a valid token', async () => {
    const res = await api(ctx.tokens.member).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('member@test.com');
  });

  it('rejects requests without a token', async () => {
    expect((await request(app).get('/api/projects')).status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const res = await api(`${ctx.tokens.member}x`).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('changes password with the correct current password', async () => {
    const res = await api(ctx.tokens.outsider)
      .post('/api/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass@456' });
    expect(res.status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ email: 'outsider@test.com', password: 'NewPass@456' });
    expect(login.status).toBe(200);
  });
});

describe('User management (RBAC)', () => {
  it('lets an admin promote a user', async () => {
    const res = await api(ctx.tokens.admin).patch(`/api/users/${ctx.users.outsider.id}`).send({ role: 'PROJECT_MANAGER' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('PROJECT_MANAGER');
    await api(ctx.tokens.admin).patch(`/api/users/${ctx.users.outsider.id}`).send({ role: 'TEAM_MEMBER' });
  });

  it('forbids team members from listing users', async () => {
    expect((await api(ctx.tokens.member).get('/api/users')).status).toBe(403);
  });

  it('forbids a project manager from changing roles', async () => {
    const res = await api(ctx.tokens.pm).patch(`/api/users/${ctx.users.member.id}`).send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('paginates and searches users', async () => {
    const res = await api(ctx.tokens.admin).get('/api/users?search=manager&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it('prevents an admin from deactivating themselves', async () => {
    const res = await api(ctx.tokens.admin).delete(`/api/users/${ctx.users.admin.id}`);
    expect(res.status).toBe(400);
  });
});
