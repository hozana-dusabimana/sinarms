const supertest = require('supertest');
const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { loginAdmin } = require('./helpers/auth');

const describeIf = mysqlAvailable() ? describe : describe.skip;

describeIf('API organizations (admin)', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('admin can create/update/toggle organization', async () => {
    const agent = supertest.agent(app);
    const login = await loginAdmin(agent);
    expect(login.status).toBe(200);

    const created = await agent.post('/api/organizations').send({
      name: 'Test Org',
      description: 'Org for automated tests',
      contactEmail: 'qa@example.com',
      contactPhone: '+250700000000',
      address: 'Kigali',
    });
    expect(created.status).toBe(201);
    expect(created.body && created.body.id).toBeTruthy();

    const list = await agent.get('/api/organizations');
    expect(list.status).toBe(200);
    expect(list.body.find((org) => org.id === created.body.id)).toBeTruthy();

    const updated = await agent.put(`/api/organizations/${created.body.id}`).send({ description: 'Updated' });
    expect(updated.status).toBe(200);
    expect(updated.body.description).toBe('Updated');

    const toggled = await agent.delete(`/api/organizations/${created.body.id}`);
    expect(toggled.status).toBe(200);
    expect(['active', 'inactive']).toContain(toggled.body.status);
  });

  test('admin can create location under organization', async () => {
    const agent = supertest.agent(app);
    const login = await loginAdmin(agent);
    expect(login.status).toBe(200);

    const orgs = await agent.get('/api/organizations');
    expect(orgs.status).toBe(200);
    const orgId = orgs.body[0].id;

    const createdLocation = await agent.post(`/api/organizations/${orgId}/locations`).send({
      name: 'QA Location',
      address: 'Test Address',
      floorCount: 1,
      description: 'Used for automated tests',
    });
    expect(createdLocation.status).toBe(201);
    expect(createdLocation.body && createdLocation.body.id).toBeTruthy();

    const locations = await agent.get(`/api/organizations/${orgId}/locations`);
    expect(locations.status).toBe(200);
    expect(locations.body.find((loc) => loc.id === createdLocation.body.id)).toBeTruthy();
  });
});

