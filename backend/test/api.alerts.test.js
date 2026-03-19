const supertest = require('supertest');
const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { loginReceptionist } = require('./helpers/auth');

const describeIf = mysqlAvailable() ? describe : describe.skip;

describeIf('API alerts (staff)', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('unauthenticated alerts list returns 401', async () => {
    const agent = supertest.agent(app);
    const res = await agent.get('/api/alerts');
    expect(res.status).toBe(401);
  });

  test('receptionist can list active alerts', async () => {
    const agent = supertest.agent(app);
    const login = await loginReceptionist(agent);
    expect(login.status).toBe(200);

    const res = await agent.get('/api/alerts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

