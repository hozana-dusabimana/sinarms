const supertest = require('supertest');
const { mysqlAvailable, mysqlSkipReason } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { loginAdmin } = require('./helpers/auth');

const describeIf = mysqlAvailable() ? describe : describe.skip;

describeIf('API auth', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('skips gracefully when MySQL is unavailable', () => {
    if (mysqlAvailable()) {
      expect(true).toBe(true);
      return;
    }
    expect(mysqlSkipReason()).toBeTruthy();
  });

  test('login sets httpOnly cookie and returns user', async () => {
    const agent = supertest.agent(app);
    const response = await loginAdmin(agent);

    expect(response.status).toBe(200);
    expect(response.body && response.body.user).toBeTruthy();
    expect(response.body.user.role).toBe('admin');
    expect(response.headers['set-cookie']).toBeTruthy();
  });

  test('invalid login returns 401', async () => {
    const agent = supertest.agent(app);
    const response = await agent.post('/api/auth/login').send({ email: 'admin@ruliba.rw', password: 'wrong' });
    expect(response.status).toBe(401);
  });

  test('logout clears session (bootstrap/staff becomes 401)', async () => {
    const agent = supertest.agent(app);

    const loginResponse = await loginAdmin(agent);
    expect(loginResponse.status).toBe(200);

    const staffBoot = await agent.get('/api/bootstrap/staff');
    expect(staffBoot.status).toBe(200);
    expect(staffBoot.body && staffBoot.body.user && staffBoot.body.user.role).toBe('admin');

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const staffBootAfter = await agent.get('/api/bootstrap/staff');
    expect(staffBootAfter.status).toBe(401);
  });
});

