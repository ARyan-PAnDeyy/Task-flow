const { sequelize, setupDatabase, api } = require('./helpers');

let ctx;
let projectId;

beforeAll(async () => {
  ctx = await setupDatabase();
});
afterAll(() => sequelize.close());

describe('Project CRUD & RBAC', () => {
  it('lets a PM create a project and makes them its manager', async () => {
    const res = await api(ctx.tokens.pm)
      .post('/api/projects')
      .send({
        name: 'Website Redesign',
        description: 'New marketing site',
        startDate: '2026-12-01',
        deadline: '2027-01-31',
        managerId: ctx.users.pm2.id, // ignored for PMs
        memberIds: [ctx.users.member.id],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.managerId).toBe(ctx.users.pm.id);
    expect(res.body.data.members.map((m) => m.id)).toEqual([ctx.users.member.id]);
    expect(res.body.data.stats.progress).toBe(0);
    projectId = res.body.data.id;
  });

  it('forbids team members from creating projects', async () => {
    const res = await api(ctx.tokens.member).post('/api/projects').send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('rejects a deadline before the start date', async () => {
    const res = await api(ctx.tokens.pm)
      .post('/api/projects')
      .send({ name: 'Bad dates', startDate: '2027-01-10', deadline: '2027-01-01' });
    expect(res.status).toBe(400);
  });

  it('lets an admin create a project for another manager', async () => {
    const res = await api(ctx.tokens.admin).post('/api/projects').send({ name: 'Admin Project', managerId: ctx.users.pm2.id });
    expect(res.status).toBe(201);
    expect(res.body.data.manager.id).toBe(ctx.users.pm2.id);
  });

  it('rejects a team member as project manager', async () => {
    const res = await api(ctx.tokens.admin).post('/api/projects').send({ name: 'X project', managerId: ctx.users.member.id });
    expect(res.status).toBe(400);
  });

  it('shows members only the projects they belong to', async () => {
    const member = await api(ctx.tokens.member).get('/api/projects');
    expect(member.body.data.map((p) => p.name)).toEqual(['Website Redesign']);

    const outsider = await api(ctx.tokens.outsider).get('/api/projects');
    expect(outsider.body.data).toHaveLength(0);

    const admin = await api(ctx.tokens.admin).get('/api/projects');
    expect(admin.body.pagination.total).toBe(2);
  });

  it('hides inaccessible projects behind a 404', async () => {
    expect((await api(ctx.tokens.outsider).get(`/api/projects/${projectId}`)).status).toBe(404);
  });

  it('supports search and status filter', async () => {
    const res = await api(ctx.tokens.admin).get('/api/projects?search=website&status=ACTIVE');
    expect(res.body.data).toHaveLength(1);
    const none = await api(ctx.tokens.admin).get('/api/projects?status=COMPLETED');
    expect(none.body.data).toHaveLength(0);
  });

  it('lets the manager update their project', async () => {
    const res = await api(ctx.tokens.pm).patch(`/api/projects/${projectId}`).send({ status: 'ON_HOLD' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ON_HOLD');
  });

  it('forbids another PM from updating it', async () => {
    const res = await api(ctx.tokens.pm2).patch(`/api/projects/${projectId}`).send({ status: 'ACTIVE' });
    expect(res.status).toBe(404); // not visible to them at all
  });

  it('forbids a member from updating it', async () => {
    const res = await api(ctx.tokens.member).patch(`/api/projects/${projectId}`).send({ status: 'ACTIVE' });
    expect(res.status).toBe(403);
  });

  it('only allows admins to reassign the manager', async () => {
    const pmRes = await api(ctx.tokens.pm).patch(`/api/projects/${projectId}`).send({ managerId: ctx.users.pm2.id });
    expect(pmRes.status).toBe(403);
  });
});

describe('Project members', () => {
  it('adds members idempotently', async () => {
    const res = await api(ctx.tokens.pm)
      .post(`/api/projects/${projectId}/members`)
      .send({ userIds: [ctx.users.member.id, ctx.users.outsider.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(2);
  });

  it('removes a member and unassigns their tasks', async () => {
    const task = await api(ctx.tokens.pm)
      .post('/api/tasks')
      .send({ title: 'Outsider task', projectId, assigneeId: ctx.users.outsider.id });
    expect(task.status).toBe(201);

    const res = await api(ctx.tokens.pm).delete(`/api/projects/${projectId}/members/${ctx.users.outsider.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(1);

    const after = await api(ctx.tokens.pm).get(`/api/tasks/${task.body.data.id}`);
    expect(after.body.data.assigneeId).toBeNull();
  });

  it('returns 404 when removing a non-member', async () => {
    const res = await api(ctx.tokens.pm).delete(`/api/projects/${projectId}/members/${ctx.users.pm2.id}`);
    expect(res.status).toBe(404);
  });
});

describe('Project deletion', () => {
  it('cascades to tasks', async () => {
    const res = await api(ctx.tokens.pm).delete(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);
    const tasks = await api(ctx.tokens.admin).get(`/api/tasks?projectId=${projectId}`);
    expect(tasks.body.data).toHaveLength(0);
  });

  it('records audit entries visible to admins only', async () => {
    const res = await api(ctx.tokens.admin).get('/api/audit-logs?entityType=Project');
    expect(res.status).toBe(200);
    const actions = res.body.data.map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATE', 'UPDATE', 'ADD_MEMBERS', 'REMOVE_MEMBER', 'DELETE']));
    expect((await api(ctx.tokens.pm).get('/api/audit-logs')).status).toBe(403);
  });
});
