const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { mutateState } = require('../src/data/store');
const { registerVisitor, rerouteVisitor } = require('../src/services/domain');

const describeIf = mysqlAvailable() ? describe : describe.skip;

// Seeded Qonics coordinates (see seed.js): the whole site spans ~45 m, so a
// fix a few metres from the meeting room is also "near" every other node —
// nearest-node selection is what the reroute must get right.
const NEAR_MEETING_ROOM = { lat: -1.930005, lng: 30.070420 };
const FAR_FROM_SITE = { lat: -1.940000, lng: 30.070400 }; // ~1.1 km south

async function seedQonicsVisitor(id) {
  const nowIso = new Date().toISOString();
  await mutateState((draft) => {
    draft.visitors.unshift({
      id,
      name: `Visitor ${id}`,
      idNumber: '',
      phone: '0788000000',
      organizationId: 'org-qonics',
      locationId: 'loc-qonics-main',
      checkinTime: nowIso,
      checkoutTime: null,
      status: 'active',
      destinationText: 'Meeting Room',
      destinationNodeId: 'meeting-room',
      routeNodeIds: ['entrance', 'meeting-room'],
      routeSteps: [],
      // The GPS step-advance snap never fired, so the tracked node is still
      // the check-in default — the exact staleness the reroute must survive.
      currentNodeId: 'entrance',
      lastPositionUpdateAt: nowIso,
      source: 'self',
      hostName: '',
      language: 'en',
      durationMin: null,
      arrivedAt: null,
      departmentNotifiedAt: null,
      departmentNotificationBy: null,
      survey: null,
    });
    return draft;
  });
}

describeIf('domain — rerouteVisitor start node', () => {
  beforeAll(async () => {
    await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
    await seedQonicsVisitor('v-reroute');
  });

  test('starts the new route from the node nearest the live GPS fix, not the stale tracked node', async () => {
    const visitor = await rerouteVisitor({
      actorUser: null,
      visitorId: 'v-reroute',
      destinationNodeId: 'manager-office',
      currentPosition: NEAR_MEETING_ROOM,
    });

    expect(visitor.routeNodeIds[0]).toBe('meeting-room');
    expect(visitor.currentNodeId).toBe('meeting-room');
    expect(visitor.routeNodeIds[visitor.routeNodeIds.length - 1]).toBe('manager-office');
  });

  test('falls back to the tracked node when no position is sent', async () => {
    const visitor = await rerouteVisitor({
      actorUser: null,
      visitorId: 'v-reroute',
      destinationNodeId: 'manager-office',
    });

    expect(visitor.routeNodeIds[0]).toBe('entrance');
    expect(visitor.currentNodeId).toBe('entrance');
  });

  test('ignores a fix that is too far from every node', async () => {
    const visitor = await rerouteVisitor({
      actorUser: null,
      visitorId: 'v-reroute',
      destinationNodeId: 'manager-office',
      currentPosition: FAR_FROM_SITE,
    });

    expect(visitor.routeNodeIds[0]).toBe('entrance');
  });

  test('ignores a malformed position', async () => {
    const visitor = await rerouteVisitor({
      actorUser: null,
      visitorId: 'v-reroute',
      destinationNodeId: 'manager-office',
      currentPosition: { lat: 'not-a-number', lng: null },
    });

    expect(visitor.routeNodeIds[0]).toBe('entrance');
  });

  test('self check-in with a GPS fix starts the route at the nearest node', async () => {
    const { visitor } = await registerVisitor({
      actorUser: null,
      source: 'self',
      payload: {
        name: 'GPS Checkin',
        idOrPhone: '0788000002',
        destinationText: 'Manager Office',
        destinationNodeId: 'manager-office',
        organizationId: 'org-qonics',
        locationId: 'loc-qonics-main',
        gpsLat: NEAR_MEETING_ROOM.lat,
        gpsLng: NEAR_MEETING_ROOM.lng,
      },
    });

    expect(visitor.routeNodeIds[0]).toBe('meeting-room');
    expect(visitor.currentNodeId).toBe('meeting-room');
  });

  test('self check-in without GPS keeps the entrance start', async () => {
    const { visitor } = await registerVisitor({
      actorUser: null,
      source: 'self',
      payload: {
        name: 'No GPS Checkin',
        idOrPhone: '0788000003',
        destinationText: 'Manager Office',
        destinationNodeId: 'manager-office',
        organizationId: 'org-qonics',
        locationId: 'loc-qonics-main',
      },
    });

    expect(visitor.routeNodeIds[0]).toBe('entrance');
  });

  test('switching location still starts from that location\'s entrance, position ignored', async () => {
    const visitor = await rerouteVisitor({
      actorUser: null,
      visitorId: 'v-reroute',
      destinationNodeId: 'clinic',
      locationId: 'loc-rp-tumba-main',
      currentPosition: NEAR_MEETING_ROOM,
    });

    expect(visitor.locationId).toBe('loc-rp-tumba-main');
    expect(visitor.routeNodeIds[0]).toBe('entrance');
    expect(visitor.routeNodeIds[visitor.routeNodeIds.length - 1]).toBe('clinic');
  });
});
