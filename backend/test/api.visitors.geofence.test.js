const supertest = require('supertest');
const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { loginReceptionist } = require('./helpers/auth');

const describeIf = mysqlAvailable() ? describe : describe.skip;

// Coordinates roughly in central Kigali — many km from any seeded location's
// entrance node. Used as the "far away" GPS reading.
const FAR_LAT = -1.94995;
const FAR_LNG = 30.05885;

async function pickContext(agent) {
  const boot = await agent.get('/api/bootstrap/public');
  expect(boot.status).toBe(200);
  const { organizations, locations, maps } = boot.body.state;

  const location = locations[0];
  const organization =
    organizations.find((org) => org.id === location.organizationId) || organizations[0];
  const map = maps[location.id];
  const entrance = map.nodes.find((node) => node.id === 'entrance');
  const destination =
    map.nodes.find((node) => node.type === 'office') ||
    map.nodes.find((node) => node.type !== 'exit' && node.type !== 'checkpoint');

  expect(entrance).toBeTruthy();
  expect(entrance.lat).toBeDefined();
  expect(entrance.lng).toBeDefined();
  expect(destination).toBeTruthy();

  return { organization, location, entrance, destination };
}

describeIf('API visitors — geofenced self check-in', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('self check-in is rejected with 422 when GPS is beyond 100 m of the entrance', async () => {
    const agent = supertest.agent(app);
    const { organization, location, destination } = await pickContext(agent);

    const response = await agent.post('/api/visitors/checkin').send({
      name: 'Remote Visitor',
      idOrPhone: '0788000000',
      destinationText: destination.label,
      language: 'en',
      organizationId: organization.id,
      locationId: location.id,
      gpsLat: FAR_LAT,
      gpsLng: FAR_LNG,
    });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('OUT_OF_RANGE');
    expect(response.body.message).toMatch(/entrance/i);
  });

  test('self check-in succeeds when GPS is at the entrance', async () => {
    const agent = supertest.agent(app);
    const { organization, location, destination, entrance } = await pickContext(agent);

    const response = await agent.post('/api/visitors/checkin').send({
      name: 'Onsite Visitor',
      idOrPhone: '0788000001',
      destinationText: destination.label,
      language: 'en',
      organizationId: organization.id,
      locationId: location.id,
      gpsLat: Number(entrance.lat),
      gpsLng: Number(entrance.lng),
    });

    expect(response.status).toBe(200);
    expect(response.body.visitor).toBeTruthy();
    expect(response.body.visitor.status).toBe('active');
  });

  test('self check-in still works when no GPS coordinates are provided', async () => {
    // The visitor app skips GPS gating when the browser denied location
    // permission. The receptionist must close those visits manually.
    const agent = supertest.agent(app);
    const { organization, location, destination } = await pickContext(agent);

    const response = await agent.post('/api/visitors/checkin').send({
      name: 'No-GPS Visitor',
      idOrPhone: '0788000002',
      destinationText: destination.label,
      language: 'en',
      organizationId: organization.id,
      locationId: location.id,
    });

    expect(response.status).toBe(200);
    expect(response.body.visitor.status).toBe('active');
  });

  test('receptionist-initiated manual registration bypasses the geofence', async () => {
    const agent = supertest.agent(app);
    const login = await loginReceptionist(agent);
    expect(login.status).toBe(200);

    // Pull context with the *authenticated* agent so the bootstrap returns
    // the receptionist's scoped state.
    const boot = await agent.get('/api/bootstrap/staff');
    expect(boot.status).toBe(200);
    const { locations, maps } = boot.body.state;
    const location = locations.find((loc) => loc.id === login.body.user.locationId) || locations[0];
    const map = maps[location.id];
    const destination =
      map.nodes.find((node) => node.type === 'office') ||
      map.nodes.find((node) => node.type !== 'exit' && node.type !== 'checkpoint');

    const response = await agent.post('/api/visitors/manual-register').send({
      name: 'Walk-in Visitor',
      idOrPhone: '0788000003',
      destinationText: destination.label,
      language: 'en',
      organizationId: location.organizationId,
      locationId: location.id,
      // Same far-away GPS as the rejected case — manual source must ignore it.
      gpsLat: FAR_LAT,
      gpsLng: FAR_LNG,
    });

    expect(response.status).toBe(200);
    expect(response.body.visitor.status).toBe('active');
  });
});

describeIf('API visitors — checkout idempotency', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('survey can be submitted after an auto-checkout has already exited the visitor', async () => {
    const agent = supertest.agent(app);
    const { organization, location, destination, entrance } = await pickContext(agent);

    const checkin = await agent.post('/api/visitors/checkin').send({
      name: 'Survey Visitor',
      idOrPhone: '0788000004',
      destinationText: destination.label,
      language: 'en',
      organizationId: organization.id,
      locationId: location.id,
      gpsLat: Number(entrance.lat),
      gpsLng: Number(entrance.lng),
    });
    expect(checkin.status).toBe(200);
    const visitorId = checkin.body.visitor.id;

    // First checkout — simulates the geofenced auto-checkout (no survey).
    const firstCheckout = await agent.post('/api/visitors/checkout').send({ id: visitorId });
    expect(firstCheckout.status).toBe(200);
    expect(firstCheckout.body.status).toBe('exited');
    expect(firstCheckout.body.survey).toBeFalsy();

    // Second checkout — visitor submits the survey on the rating screen.
    const second = await agent.post('/api/visitors/checkout').send({
      id: visitorId,
      survey: { overall: 4 },
    });
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('exited');
    expect(second.body.survey).toEqual({ overall: 4 });
  });

  test('checkout with no survey on an already-exited visitor returns 404 (no-op)', async () => {
    const agent = supertest.agent(app);
    const { organization, location, destination, entrance } = await pickContext(agent);

    const checkin = await agent.post('/api/visitors/checkin').send({
      name: 'Double Checkout',
      idOrPhone: '0788000005',
      destinationText: destination.label,
      language: 'en',
      organizationId: organization.id,
      locationId: location.id,
      gpsLat: Number(entrance.lat),
      gpsLng: Number(entrance.lng),
    });
    expect(checkin.status).toBe(200);
    const visitorId = checkin.body.visitor.id;

    const first = await agent.post('/api/visitors/checkout').send({ id: visitorId });
    expect(first.status).toBe(200);

    const second = await agent.post('/api/visitors/checkout').send({ id: visitorId });
    expect(second.status).toBe(404);
  });
});
