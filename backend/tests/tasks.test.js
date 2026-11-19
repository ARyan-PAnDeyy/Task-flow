const { sequelize, setupDatabase, api } = require('./helpers');

let ctx;
let projectId;
let taskId;

beforeAll(async () => {
  ctx = await setupDatabase();
  const res = await api(ctx.tokens.pm)
    .post('/api/projects')
    .send({ name: 'Task Project', memberIds: [ctx.users.member.id] });
  projectId = res.body.data.id;
});
afterAll(() => sequelize.close());

describe('Task management', () => {
  it('lets the PM create and assign a task', async () => {
    const res = await api(ctx.tokens.pm).post('/api/tasks').send({
      title: 'Build login page',
      projectId,
      priority: 'HIGH',
      dueDate: '2020-01-01',
      assigneeId: ctx.users.member.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('TODO');
    expect(res.body.data.assignee.id).toBe(ctx.users.member.id);
    taskId = res.body.data.id;
  });

  it('rejects assigning to a non-member', async () => {
    const res = await api(ctx.tokens.pm)
      .post('/api/tasks')
      .send({ title: 'Bad assignee', projectId, assigneeId: ctx.users.outsider.id });
    expect(res.status).toBe(400);
  });

  it('rejects invalid priority values', async () => {
    const res = await api(ctx.tokens.pm).post('/api/tasks').send({ title: 'Bad', projectId, priority: 'URGENT' });
    expect(res.status).toBe(400);
  });

  it('forbids team members from creating tasks', async () => {
    const res = await api(ctx.tokens.member).post('/api/tasks').send({ title: 'Mine', projectId });
    expect(res.status).toBe(403);
  });

  it('lets the assignee update status and sets completedAt', async () => {
    const res = await api(ctx.tokens.member).patch(`/api/tasks/${taskId}`).send({ status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.data.completedAt).not.toBeNull();

    const reopened = await api(ctx.tokens.member).patch(`/api/tasks/${taskId}`).send({ status: 'IN_PROGRESS' });
    expect(reopened.body.data.completedAt).toBeNull();
  });

  it('forbids the assignee from editing other fields', async () => {
    const res = await api(ctx.tokens.member).patch(`/api/tasks/${taskId}`).send({ priority: 'LOW' });
    expect(res.status).toBe(403);
  });

  it('hides tasks from users outside the project', async () => {
    expect((await api(ctx.tokens.outsider).get(`/api/tasks/${taskId}`)).status).toBe(404);
  });

  it('filters, searches and paginates tasks', async () => {
    await api(ctx.tokens.pm).post('/api/tasks').send({ title: 'Write docs', projectId, priority: 'LOW' });
    await api(ctx.tokens.pm).post('/api/tasks').send({ title: 'Deploy app', projectId, priority: 'MEDIUM' });

    const high = await api(ctx.tokens.pm).get('/api/tasks?priority=HIGH');
    expect(high.body.data.map((t) => t.title)).toEqual(['Build login page']);

    const search = await api(ctx.tokens.pm).get('/api/tasks?search=docs');
    expect(search.body.data).toHaveLength(1);

    const mine = await api(ctx.tokens.member).get('/api/tasks?assigneeId=me');
    expect(mine.body.data).toHaveLength(1);

    const unassigned = await api(ctx.tokens.pm).get('/api/tasks?assigneeId=unassigned');
    expect(unassigned.body.data).toHaveLength(2);

    const overdue = await api(ctx.tokens.pm).get('/api/tasks?overdue=true');
    expect(overdue.body.data.map((t) => t.id)).toEqual([taskId]);

    const page = await api(ctx.tokens.pm).get('/api/tasks?limit=2&page=2&sort=title:asc');
    expect(page.body.data).toHaveLength(1);
    expect(page.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });
});

describe('Comments', () => {
  let commentId;

  it('lets project members comment', async () => {
    const res = await api(ctx.tokens.member).post(`/api/tasks/${taskId}/comments`).send({ content: 'On it!' });
    expect(res.status).toBe(201);
    expect(res.body.data.author.id).toBe(ctx.users.member.id);
    commentId = res.body.data.id;
  });

  it('rejects empty comments', async () => {
    const res = await api(ctx.tokens.member).post(`/api/tasks/${taskId}/comments`).send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('lists comments for the task', async () => {
    const res = await api(ctx.tokens.pm).get(`/api/tasks/${taskId}/comments`);
    expect(res.body.data).toHaveLength(1);
  });

  it('blocks outsiders from commenting', async () => {
    const res = await api(ctx.tokens.outsider).post(`/api/tasks/${taskId}/comments`).send({ content: 'hi' });
    expect(res.status).toBe(404);
  });

  it('lets the project manager delete any comment', async () => {
    expect((await api(ctx.tokens.pm).delete(`/api/comments/${commentId}`)).status).toBe(200);
  });
});

describe('Attachments', () => {
  let attachmentId;

  it('uploads a file', async () => {
    const res = await api(ctx.tokens.member)
      .post(`/api/tasks/${taskId}/attachments`)
      .attach('file', Buffer.from('hello world'), 'notes.txt');
    expect(res.status).toBe(201);
    expect(res.body.data.originalName).toBe('notes.txt');
    expect(res.body.data.size).toBe(11);
    attachmentId = res.body.data.id;
  });

  it('rejects disallowed file types', async () => {
    const res = await api(ctx.tokens.member)
      .post(`/api/tasks/${taskId}/attachments`)
      .attach('file', Buffer.from('MZ'), 'virus.exe');
    expect(res.status).toBe(400);
  });

  it('downloads the file with its original name', async () => {
    const res = await api(ctx.tokens.pm).get(`/api/attachments/${attachmentId}/download`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('notes.txt');
  });

  it('forbids non-owners (non-managers) from deleting', async () => {
    await api(ctx.tokens.pm).post(`/api/projects/${projectId}/members`).send({ userIds: [ctx.users.outsider.id] });
    expect((await api(ctx.tokens.outsider).delete(`/api/attachments/${attachmentId}`)).status).toBe(403);
    expect((await api(ctx.tokens.member).delete(`/api/attachments/${attachmentId}`)).status).toBe(200);
  });
});

describe('Dashboard', () => {
  it('returns scoped statistics', async () => {
    const res = await api(ctx.tokens.pm).get('/api/dashboard');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.summary.totalProjects).toBe(1);
    expect(d.summary.totalTasks).toBe(3);
    expect(d.tasksByPriority).toEqual({ LOW: 1, MEDIUM: 1, HIGH: 1 });
    expect(d.completionTrend).toHaveLength(14);
    expect(d.teamPerformance[0].user.id).toBe(ctx.users.member.id);
    expect(d.projectProgress[0]).toHaveProperty('progress');
  });

  it('returns empty stats for a user with no projects', async () => {
    const res = await api(ctx.tokens.pm2).get('/api/dashboard');
    expect(res.body.data.summary.totalTasks).toBe(0);
  });
});

describe('Task deletion', () => {
  it('forbids members from deleting tasks', async () => {
    expect((await api(ctx.tokens.member).delete(`/api/tasks/${taskId}`)).status).toBe(403);
  });

  it('lets the manager delete a task', async () => {
    expect((await api(ctx.tokens.pm).delete(`/api/tasks/${taskId}`)).status).toBe(200);
    expect((await api(ctx.tokens.pm).get(`/api/tasks/${taskId}`)).status).toBe(404);
  });
});
