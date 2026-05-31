const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { getState, mutateState } = require('../src/data/store');
const { escalateUntrackedVisitors } = require('../src/services/domain');

const describeIf = mysqlAvailable() ? describe : describe.skip;

const MINUTE = 60 * 1000;

// Insert a synthetic active visitor whose last position report was `idleMinutes`
// ago. Returns the visitor id.
async function seedActiveVisitor({ idleMinutes, id = 'visitor-untracked' }) {
  const now = Date.now();
  const state = await getState();
  const location = state.locations[0];

  await mutateState((draft) => {
    draft.visitors.unshift({
      id,
      name: 'Untracked Visitor',
      idNumber: '',
      phone: '0788123456',
      organizationId: location.organizationId,
      locationId: location.id,
      checkinTime: new Date(now - (idleMinutes + 5) * MINUTE).toISOString(),
      checkoutTime: null,
      status: 'active',
      destinationText: 'Reception',
      destinationNodeId: 'entrance',
      routeNodeIds: ['entrance'],
      routeSteps: [],
      currentNodeId: 'entrance',
      lastPositionUpdateAt: new Date(now - idleMinutes * MINUTE).toISOString(),
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

  return id;
}

function gpsLostAlerts(state, visitorId) {
  return state.alerts.filter(
    (a) => a.visitorId === visitorId && a.type === 'GPS_LOST' && !a.resolvedAt,
  );
}

describeIf('domain — escalateUntrackedVisitors', () => {
  beforeAll(async () => {
    await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('raises a scoped GPS_LOST alert for an untracked visitor WITHOUT checking them out', async () => {
    const id = await seedActiveVisitor({ idleMinutes: 30 }); // > default 20

    const escalated = await escalateUntrackedVisitors();
    expect(escalated.some((v) => v.id === id)).toBe(true);

    const state = await getState();
    const visitor = state.visitors.find((v) => v.id === id);
    // The visit must stay open — GPS off is not proof they left.
    expect(visitor.status).toBe('active');
    expect(visitor.checkoutTime).toBeNull();
    expect(visitor.durationMin).toBeNull();

    const alerts = gpsLostAlerts(state, id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('medium');
    expect(alerts[0].message).toMatch(/GPS/i);
  });

  test('leaves a recently-tracked visitor alone (no alert)', async () => {
    const id = await seedActiveVisitor({ idleMinutes: 5 });

    const escalated = await escalateUntrackedVisitors();
    expect(escalated.some((v) => v.id === id)).toBe(false);

    const state = await getState();
    expect(gpsLostAlerts(state, id)).toHaveLength(0);
  });

  test('does not raise a duplicate alert on a second pass', async () => {
    const id = await seedActiveVisitor({ idleMinutes: 30 });

    await escalateUntrackedVisitors();
    await escalateUntrackedVisitors();

    const state = await getState();
    expect(gpsLostAlerts(state, id)).toHaveLength(1);
  });

  test('auto-resolves the alert once the visitor reports a fresh position', async () => {
    const id = await seedActiveVisitor({ idleMinutes: 30 });
    await escalateUntrackedVisitors();
    expect(gpsLostAlerts(await getState(), id)).toHaveLength(1);

    // GPS comes back: refresh the last-seen timestamp to now.
    await mutateState((draft) => {
      const visitor = draft.visitors.find((v) => v.id === id);
      visitor.lastPositionUpdateAt = new Date().toISOString();
      return draft;
    });

    await escalateUntrackedVisitors();
    expect(gpsLostAlerts(await getState(), id)).toHaveLength(0);
  });
});
