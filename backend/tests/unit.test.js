const { getPagination, paginated, getSort } = require('../src/utils/pagination');
const v = require('../src/validators');
const ApiError = require('../src/utils/ApiError');
const { app, request, sequelize } = require('./helpers');

afterAll(() => sequelize.close());

describe('pagination utils', () => {
  it('defaults to page 1, limit 10', () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 10, offset: 0 });
  });

  it('clamps limit and computes offset', () => {
    expect(getPagination({ page: '3', limit: '500' })).toEqual({ page: 3, limit: 100, offset: 200 });
  });

  it('builds the envelope', () => {
    expect(paginated([1, 2], 25, { page: 2, limit: 10 }).pagination).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  it('only sorts on allowed fields', () => {
    expect(getSort('name:desc', ['name'])).toEqual([['name', 'DESC']]);
    expect(getSort('password:asc', ['name'])).toEqual([['createdAt', 'DESC']]);
  });
});

describe('validators', () => {
  it('requires a strong password', () => {
    const { error } = v.register.validate({ name: 'Joe', email: 'joe@x.com', password: 'alllowercase1' });
    expect(error.message).toMatch(/uppercase/);
  });

  it('strips unknown fields', () => {
    const { value } = v.createComment.validate({ content: 'hi', userId: 99 }, { stripUnknown: true });
    expect(value).toEqual({ content: 'hi' });
  });

  it('accepts special assignee filters', () => {
    expect(v.taskList.validate({ assigneeId: 'me' }).error).toBeUndefined();
    expect(v.taskList.validate({ assigneeId: 'someone' }).error).toBeDefined();
  });
});

describe('ApiError', () => {
  it('carries status codes', () => {
    expect(ApiError.notFound().statusCode).toBe(404);
    expect(ApiError.forbidden().statusCode).toBe(403);
  });
});

describe('error handling', () => {
  it('does not reveal unknown API routes to anonymous callers', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.body.openapi).toBe('3.0.3');
  });
});
