const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');
const { getState, mutateState } = require('../src/data/store');
const {
  scopeNotifications,
  scopeVisitors,
  buildAnalytics,
  registerVisitor,
} = require('../src/services/domain');

const describeIf = mysqlAvailable() ? describe : describe.skip;

const DAY = 24 * 60 * 60 * 1000;

// Insert an active visitor for a given org/location, optionally checked in on a
// previous day, and (optionally) a matching VISITOR_CHECKIN notification.
async function seedVisitor({ id, org, loc, status = 'active', daysAgo = 0, withNotification = true }) {
  const checkinTime = new Date(Date.now() - daysAgo * DAY).toISOString();
  await mutateState((draft) => {
    draft.visitors.unshift({
      id,
      name: `Visitor ${id}`,
      idNumber: '',
      phone: '0788000000',
      organizationId: org,
      locationId: loc,
      checkinTime,
      checkoutTime: status === 'active' ? null : checkinTime,
      status,
      destinationText: 'Reception',
      destinationNodeId: 'entrance',
      routeNodeIds: ['entrance'],
      routeSteps: [],
      currentNodeId: 'entrance',
      lastPositionUpdateAt: checkinTime,
      source: 'self',
      hostName: '',
      language: 'en',
      durationMin: status === 'active' ? null : 5,
      arrivedAt: null,
      departmentNotifiedAt: null,
      departmentNotificationBy: null,
      survey: null,
    });
    if (withNotification) {
      draft.notifications.unshift({
        id: `notify-${id}`,
        type: 'VISITOR_CHECKIN',
        visitorId: id,
        message: `Visitor ${id} checked in.`,
        createdAt: checkinTime,
        createdBy: 'system',
      });
    }
    return draft;
  });
}

const ruliba = { role: 'receptionist', organizationId: 'org-ruliba', locationId: 'loc-ruliba-main' };
const qonics = { role: 'receptionist', organizationId: 'org-qonics', locationId: 'loc-qonics-main' };
const admin = { role: 'admin', organizationId: null, locationId: null };

describeIf('domain — tenant scoping for the receptionist dashboard', () => {
  beforeAll(async () => {
    await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
    // Start from an empty visitor/notification set so each assertion is about
    // exactly the rows the test inserts, not seed fixtures.
    await mutateState((draft) => {
      draft.visitors = [];
      draft.visitorPositions = [];
      draft.alerts = [];
      draft.notifications = [];
      return draft;
    });
  });

  test('a receptionist only sees notifications for visitors in their own org + location', async () => {
    await seedVisitor({ id: 'v-ruliba', org: 'org-ruliba', loc: 'loc-ruliba-main' });
    await seedVisitor({ id: 'v-qonics', org: 'org-qonics', loc: 'loc-qonics-main' });
    const state = await getState();

    const rulibaNotifs = scopeNotifications(state, ruliba);
    expect(rulibaNotifs.map((n) => n.visitorId)).toEqual(['v-ruliba']);

    const qonicsNotifs = scopeNotifications(state, qonics);
    expect(qonicsNotifs.map((n) => n.visitorId)).toEqual(['v-qonics']);
  });

  test('an admin sees every notification', async () => {
    await seedVisitor({ id: 'v-ruliba', org: 'org-ruliba', loc: 'loc-ruliba-main' });
    await seedVisitor({ id: 'v-qonics', org: 'org-qonics', loc: 'loc-qonics-main' });
    const state = await getState();

    const ids = scopeNotifications(state, admin).map((n) => n.visitorId).sort();
    expect(ids).toEqual(['v-qonics', 'v-ruliba']);
  });

  test('a notification whose visitor belongs to another location is hidden even within the same org', async () => {
    // A second, valid location under the same org as the Qonics receptionist.
    await mutateState((draft) => {
      draft.locations.push({
        id: 'loc-qonics-annex',
        organizationId: 'org-qonics',
        name: 'Qonics Inc - Annex',
        address: 'Kigali, Rwanda',
        floorCount: 1,
        description: 'Secondary site.',
        status: 'active',
        qrCodeToken: 'SINARMS-QONICS-ANNEX',
        receptionistIds: [],
        createdAt: new Date().toISOString(),
      });
      return draft;
    });
    await seedVisitor({ id: 'v-other-loc', org: 'org-qonics', loc: 'loc-qonics-annex' });
    const state = await getState();

    // Receptionist is scoped to loc-qonics-main, so the annex check-in is hidden.
    expect(scopeNotifications(state, qonics)).toHaveLength(0);
  });

  test('an active visitor who checked in on a previous day still appears in the live directory', async () => {
    await seedVisitor({ id: 'v-yesterday', org: 'org-ruliba', loc: 'loc-ruliba-main', daysAgo: 3 });
    const state = await getState();

    const directory = scopeVisitors(state, ruliba, { includeHistory: false });
    expect(directory.map((v) => v.id)).toContain('v-yesterday');
  });

  test('exited visitors from previous days stay out of the live directory', async () => {
    await seedVisitor({ id: 'v-exited-old', org: 'org-ruliba', loc: 'loc-ruliba-main', status: 'exited', daysAgo: 3 });
    const state = await getState();

    const directory = scopeVisitors(state, ruliba, { includeHistory: false });
    expect(directory.map((v) => v.id)).not.toContain('v-exited-old');
  });

  test('the live directory count matches analytics.activeVisitors for the receptionist', async () => {
    await seedVisitor({ id: 'v-today', org: 'org-ruliba', loc: 'loc-ruliba-main', daysAgo: 0 });
    await seedVisitor({ id: 'v-yesterday', org: 'org-ruliba', loc: 'loc-ruliba-main', daysAgo: 2 });
    await seedVisitor({ id: 'v-exited', org: 'org-ruliba', loc: 'loc-ruliba-main', status: 'exited', daysAgo: 1 });
    const state = await getState();

    const directoryActive = scopeVisitors(state, ruliba, { includeHistory: false })
      .filter((v) => v.status === 'active');
    const analytics = buildAnalytics(state, {
      organizationId: ruliba.organizationId,
      locationId: ruliba.locationId,
    });

    expect(directoryActive).toHaveLength(2);
    expect(analytics.activeVisitors).toBe(2);
  });

  test('registration is rejected when the org does not own the chosen location', async () => {
    // loc-qonics-main belongs to org-qonics, not org-ruliba.
    await expect(
      registerVisitor({
        actorUser: null,
        source: 'manual',
        payload: {
          name: 'Mismatch',
          idOrPhone: '1',
          destinationText: 'Reception',
          destinationNodeId: 'entrance',
          organizationId: 'org-ruliba',
          locationId: 'loc-qonics-main',
        },
      }),
    ).rejects.toMatchObject({ status: 422, code: 'ORG_LOCATION_MISMATCH' });
  });

  test('registration is rejected when the location does not exist', async () => {
    await expect(
      registerVisitor({
        actorUser: null,
        source: 'manual',
        payload: {
          name: 'NoLocation',
          idOrPhone: '1',
          destinationText: 'Reception',
          destinationNodeId: 'entrance',
          organizationId: 'org-ruliba',
          locationId: 'loc-does-not-exist',
        },
      }),
    ).rejects.toMatchObject({ status: 422, code: 'LOCATION_INVALID' });
  });

  test('analytics.todayVisitors counts only today\'s check-ins, not all-time', async () => {
    await seedVisitor({ id: 'v-today', org: 'org-ruliba', loc: 'loc-ruliba-main', daysAgo: 0 });
    await seedVisitor({ id: 'v-old-exited', org: 'org-ruliba', loc: 'loc-ruliba-main', status: 'exited', daysAgo: 5 });
    const state = await getState();

    const analytics = buildAnalytics(state, {
      organizationId: ruliba.organizationId,
      locationId: ruliba.locationId,
    });

    expect(analytics.todayVisitors).toBe(1);
    // totalVisitors stays an all-time figure (today's + the old exited one).
    expect(analytics.totalVisitors).toBe(2);
  });
});
