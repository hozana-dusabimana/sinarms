const { mysqlAvailable, mysqlSkipReason } = require('./helpers/mysqlState');

// Ensure config picks up the test settings (config is read at require-time).
process.env.PORT = process.env.PORT || '0';
process.env.DB_NAME = process.env.DB_NAME || 'sinarms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'sinarms-test-secret';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const { io } = require('socket.io-client');
const { startServer } = require('../src/server');
const { resetToSeed } = require('./helpers/testApp');

let server = null;
let baseUrl = null;
let socket = null;

function onceWithTimeout(emitter, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    emitter.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function jsonRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, data };
}

const describeIf = mysqlAvailable() ? describe : describe.skip;

describeIf('Socket.IO events', () => {
  beforeAll(async () => {
    if (!mysqlAvailable()) {
      return;
    }
    server = await startServer();
    const address = server.address();
    const port = address && typeof address === 'object' ? address.port : null;
    if (!port) {
      throw new Error('Unable to resolve test server port.');
    }

    baseUrl = `http://127.0.0.1:${port}`;

    socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
    });

    await onceWithTimeout(socket, 'system:ready', 3000);

    await resetToSeed();
  });

  afterAll(async () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
  });

  test('emits visitor:checkin, visitor:position, visitor:checkout', async () => {
  const bootstrap = await jsonRequest('/api/bootstrap/public');
  expect(bootstrap.ok).toBe(true);
  const org = bootstrap.data?.state?.organizations?.[0];
  const loc = bootstrap.data?.state?.locations?.[0];
  expect(org && loc).toBeTruthy();

  const checkinPromise = onceWithTimeout(socket, 'visitor:checkin', 4000);
  const checkin = await jsonRequest('/api/visitors/checkin', {
    method: 'POST',
    body: {
      name: 'Test Visitor',
      idOrPhone: '0700000000',
      destinationText: 'HR office',
      language: 'en',
      organizationId: org.id,
      locationId: loc.id,
    },
  });
  expect(checkin.ok).toBe(true);

  const checkinEvent = await checkinPromise;
  const visitorId = checkin.data?.visitor?.id;
  expect(visitorId).toBeTruthy();
  expect(checkinEvent?.id).toBe(visitorId);

  const nextNodeId = Array.isArray(checkinEvent?.routeNodeIds) ? checkinEvent.routeNodeIds[1] : null;
  const positionPromise = onceWithTimeout(socket, 'visitor:position', 4000);
  const position = await jsonRequest(`/api/visitors/${visitorId}/position`, {
    method: 'POST',
    body: { nodeId: nextNodeId, source: 'wifi' },
  });
  expect(position.ok).toBe(true);
  const positionEvent = await positionPromise;
  expect(positionEvent?.id).toBe(visitorId);

  const checkoutPromise = onceWithTimeout(socket, 'visitor:checkout', 4000);
  const checkout = await jsonRequest('/api/visitors/checkout', {
    method: 'POST',
    body: { id: visitorId },
  });
  expect(checkout.ok).toBe(true);
  const checkoutEvent = await checkoutPromise;
  expect(checkoutEvent?.id).toBe(visitorId);
  });
});

test('Socket.IO tests skip gracefully when MySQL is unavailable', () => {
  if (mysqlAvailable()) {
    expect(true).toBe(true);
    return;
  }

  expect(mysqlSkipReason()).toBeTruthy();
});
