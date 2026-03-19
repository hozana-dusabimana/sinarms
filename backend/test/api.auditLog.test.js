const supertest = require('supertest');
const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { loginAdmin, loginReceptionist } = require('./helpers/auth');

const describeIf = mysqlAvailable() ? describe : describe.skip;

describeIf('API audit log (admin)', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('receptionist cannot read audit log (403)', async () => {
    const agent = supertest.agent(app);
    const login = await loginReceptionist(agent);
    expect(login.status).toBe(200);

    const res = await agent.get('/api/audit-log');
    expect(res.status).toBe(403);
  });

  test('admin can read audit log and sees login entry', async () => {
    const agent = supertest.agent(app);
    const login = await loginAdmin(agent);
    expect(login.status).toBe(200);

    const res = await agent.get('/api/audit-log');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      actionType: 'LOGIN',
      targetType: 'user',
    });
  });
});

