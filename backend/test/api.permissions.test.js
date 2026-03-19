const supertest = require('supertest');
const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { loginAdmin, loginReceptionist } = require('./helpers/auth');

const describeIf = mysqlAvailable() ? describe : describe.skip;

describeIf('API permission enforcement', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('unauthenticated admin endpoints return 401', async () => {
    const agent = supertest.agent(app);
    const res = await agent.get('/api/analytics/summary');
    expect(res.status).toBe(401);
  });

  test('receptionist cannot access admin-only endpoints (403)', async () => {
    const agent = supertest.agent(app);
    const login = await loginReceptionist(agent);
    expect(login.status).toBe(200);

    const analytics = await agent.get('/api/analytics/summary');
    expect(analytics.status).toBe(403);

    const audit = await agent.get('/api/audit-log');
    expect(audit.status).toBe(403);

    const orgCreate = await agent.post('/api/organizations').send({ name: 'Blocked Org' });
    expect(orgCreate.status).toBe(403);
  });

  test('admin can access analytics summary (200)', async () => {
    const agent = supertest.agent(app);
    const login = await loginAdmin(agent);
    expect(login.status).toBe(200);

    const analytics = await agent.get('/api/analytics/summary');
    expect(analytics.status).toBe(200);
    expect(analytics.body).toMatchObject({
      totalVisitors: expect.any(Number),
      activeVisitors: expect.any(Number),
      averageDuration: expect.any(Number),
      alertsToday: expect.any(Number),
      arrivalsByDay: expect.any(Array),
      topDestinations: expect.any(Array),
    });
  });
});

