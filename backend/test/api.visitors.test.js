const supertest = require('supertest');
const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');

const describeIf = mysqlAvailable() ? describe : describe.skip;

describeIf('API visitors (public)', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('visitor can check in and then check out', async () => {
    const agent = supertest.agent(app);

    const boot = await agent.get('/api/bootstrap/public');
    expect(boot.status).toBe(200);
    const { organizations, locations, maps } = boot.body.state;
    expect(organizations.length).toBeGreaterThan(0);
    expect(locations.length).toBeGreaterThan(0);

    const location = locations[0];
    const organization = organizations.find((org) => org.id === location.organizationId) || organizations[0];
    const map = maps[location.id];
    expect(map && Array.isArray(map.nodes)).toBe(true);

    // Pick a deterministic office destination from the current map.
    const destinationNode =
      map.nodes.find((node) => node.type === 'office') ||
      map.nodes.find((node) => node.type !== 'exit' && node.type !== 'checkpoint');
    expect(destinationNode).toBeTruthy();

    const checkin = await agent.post('/api/visitors/checkin').send({
      name: 'QA Visitor',
      idOrPhone: '0788000000',
      destinationText: destinationNode.label,
      language: 'en',
      organizationId: organization.id,
      locationId: location.id,
    });

    expect(checkin.status).toBe(200);
    expect(checkin.body && checkin.body.visitor).toBeTruthy();
    expect(checkin.body.visitor.status).toBe('active');
    expect(checkin.body.visitor.locationId).toBe(location.id);

    const checkout = await agent.post('/api/visitors/checkout').send({ id: checkin.body.visitor.id });
    expect(checkout.status).toBe(200);
    expect(checkout.body.status).toBe('exited');
    expect(checkout.body.checkoutTime).toBeTruthy();
  });

  test('checkout unknown visitor returns 404', async () => {
    const agent = supertest.agent(app);
    const checkout = await agent.post('/api/visitors/checkout').send({ id: 'visitor-does-not-exist' });
    expect(checkout.status).toBe(404);
  });
});

