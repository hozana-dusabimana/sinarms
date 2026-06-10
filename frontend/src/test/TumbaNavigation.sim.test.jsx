import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { distanceMeters } from '../lib/geo';

// RP Tumba campus walking simulator. Unlike MapNavigation.sim.test.jsx (which
// uses a synthetic 3-node site), this renders MapNavigationPage against the
// REAL seeded campus — the same nodes, coordinates, edges and instructions the
// production database serves — and walks a simulated visitor across it at
// pedestrian speed with phone-grade GPS. It verifies the whole visitor-facing
// loop: where the route starts, the instruction text, the remaining-distance
// pill counting down monotonically with movement, no premature arrival, the
// arrival announcement at the destination, and (for the longest walk on
// campus) that the auto-checkout geofence never fires on a legitimate route.

import { createSeedState } from '../../../backend/src/data/seed.js';
import { calculateRoute } from '../../../backend/src/services/engine.js';

let mockSinarms = null;

vi.mock('../context/SinarmsContext', () => ({
  useSinarms: () => mockSinarms,
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    languages: ['en', 'fr', 'rw'],
    setLanguage: vi.fn(),
    label: 'EN',
    cycleLanguage: vi.fn(),
    // Append params so distance values are visible in the rendered text.
    t: (key, params) => (params ? `${key} ${Object.values(params).join(' ')}` : key),
  }),
}));

vi.mock('../components/visitor/AIChatbot', () => ({ default: () => null }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/visit/navigate', state: null }),
  };
});

// jsdom can't host Leaflet; replace react-leaflet with introspectable stubs.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ position, children }) => (
    <div data-marker="true" data-position={JSON.stringify(position)}>{children}</div>
  ),
  Popup: ({ children }) => <div>{children}</div>,
  Polyline: () => null,
  CircleMarker: ({ children }) => <div>{children}</div>,
  Rectangle: () => null,
  ImageOverlay: () => null,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn(), flyTo: vi.fn() }),
}));

import MapNavigationPage from '../pages/visitor/MapNavigationPage';

const TUMBA_LOCATION_ID = 'loc-rp-tumba-main';
const seed = createSeedState();
const tumbaMap = seed.maps[TUMBA_LOCATION_ID];
const tumbaOrg = seed.organizations.find((o) => o.id === 'org-rp-tumba');
const tumbaLocation = seed.locations.find((l) => l.id === TUMBA_LOCATION_ID);

function nodePos(nodeId) {
  const node = tumbaMap.nodes.find((n) => n.id === nodeId);
  return [Number(node.lat), Number(node.lng)];
}

function buildState({ distanceCheckEnabled = false } = {}) {
  return {
    organizations: [{ ...tumbaOrg, distanceCheckEnabled }],
    locations: [{ ...tumbaLocation }],
    maps: { [TUMBA_LOCATION_ID]: JSON.parse(JSON.stringify(tumbaMap)) },
    visitors: [],
    visitorPositions: [],
    alerts: [],
    notifications: [],
  };
}

// Exactly what registerVisitor/rerouteVisitor store: the route is computed
// from the visitor's current node (the gate at self check-in, or wherever
// they are when the destination changes mid-visit).
function buildVisitor(destinationNodeId, fromNodeId = 'entrance') {
  const route = calculateRoute(tumbaMap, fromNodeId, destinationNodeId);
  expect(route.pathNodeIds[0]).toBe(fromNodeId);
  expect(route.pathNodeIds[route.pathNodeIds.length - 1]).toBe(destinationNodeId);
  return {
    id: 'v-tumba-sim',
    name: 'Tumba Sim Visitor',
    status: 'active',
    locationId: TUMBA_LOCATION_ID,
    currentNodeId: fromNodeId,
    destinationNodeId,
    routeNodeIds: route.pathNodeIds,
    routeSteps: route.steps,
  };
}

function routeTotalM(visitor) {
  return visitor.routeSteps.reduce((sum, s) => sum + Number(s.distanceM || 0), 0);
}

// --- GPS simulation harness ---
let fire; // (coords, accuracy, tOffsetMs) => void
const BASE_TS = 1_700_000_000_000;

function installGeolocation() {
  let cb = null;
  const watchPosition = vi.fn((onSuccess) => {
    cb = onSuccess;
    return 1;
  });
  // No getCurrentPosition: keeps the hook's 4 s poll timer out of the sim.
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch: vi.fn() },
    configurable: true,
    writable: true,
  });
  fire = (coords, accuracy, tOffsetMs = 0) => {
    // Keep wall-clock (Date.now) in lockstep with the fix timestamps so the
    // auto-checkout debounce sees realistic elapsed time during the walk.
    vi.setSystemTime(BASE_TS + tOffsetMs);
    act(() => {
      cb({ coords: { latitude: coords[0], longitude: coords[1], accuracy }, timestamp: BASE_TS + tOffsetMs });
    });
  };
}

// Interpolate a straight pedestrian track between two points, one sample per
// `stepM` metres. With 10 s between samples this is ~1.6 m/s — walking pace.
function track(from, to, stepM = 16) {
  const total = distanceMeters(from, to);
  const samples = Math.max(1, Math.ceil(total / stepM));
  const points = [];
  for (let i = 1; i <= samples; i++) {
    const f = i / samples;
    points.push([from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f]);
  }
  return points;
}

function pillMeters() {
  const pill = document.querySelector('div.bottom-4');
  const match = pill?.textContent.match(/visitor\.nav\.metersAway (\d+)/);
  return match ? Number(match[1]) : null;
}

function visitorMarkerPos() {
  const markers = [...document.querySelectorAll('[data-marker]')];
  const dot = markers.find((m) => m.textContent.includes('visitor.nav.youAreHere'));
  return dot ? JSON.parse(dot.getAttribute('data-position')) : null;
}

// Walks the visitor along the line and returns the pill reading after each
// fix, advancing the simulated clock 10 s per sample.
async function walkAndSample(from, to, { accuracy = 5, startMs = 0, stepMs = 10_000 } = {}) {
  const readings = [];
  let tMs = startMs;
  for (const point of track(from, to)) {
    tMs += stepMs;
    fire(point, accuracy, tMs);
    await act(async () => {});
    const m = pillMeters();
    if (m != null) readings.push(m);
  }
  return { readings, endMs: tMs };
}

function setupVisit(destinationNodeId, stateOpts, fromNodeId = 'entrance') {
  mockSinarms = {
    state: buildState(stateOpts),
    currentVisitor: buildVisitor(destinationNodeId, fromNodeId),
    isReady: true,
    setCurrentVisitor: vi.fn().mockResolvedValue(null),
    checkoutVisitor: vi.fn().mockResolvedValue(null),
    moveVisitor: vi.fn((id, nodeId) => {
      mockSinarms.currentVisitor = { ...mockSinarms.currentVisitor, currentNodeId: nodeId };
      return Promise.resolve(mockSinarms.currentVisitor);
    }),
  };
}

describe('RP Tumba campus navigation simulation (real seeded data)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] }); // only Date — timers stay real for waitFor
    vi.setSystemTime(BASE_TS);
    installGeolocation();
  });

  afterEach(() => {
    cleanup();
    delete navigator.geolocation;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('walks a visitor from the main gate to IT Lab 7 with live countdown and arrival', async () => {
    setupVisit('it-lab-7');
    const visitor = mockSinarms.currentVisitor;
    const total = routeTotalM(visitor);
    const entrance = nodePos('entrance');
    const lab = nodePos('it-lab-7');

    render(<MapNavigationPage />);

    // At the gate: the pill shows the full seeded route distance, the marker
    // sits on the entrance, and the real seeded instruction is on screen.
    fire(entrance, 5, 0);
    expect(pillMeters()).toBe(total);
    expect(distanceMeters(visitorMarkerPos(), entrance)).toBeLessThan(5);
    expect(screen.getAllByText(/Head [\w-]+ from Main Entrance to IT Lab 7\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText('IT Lab 7').length).toBeGreaterThan(0);
    expect(mockSinarms.moveVisitor).not.toHaveBeenCalled();

    // Walk the route. The countdown must fall with movement and never climb
    // back up (small rounding jitter aside).
    const { readings, endMs } = await walkAndSample(entrance, lab);
    expect(readings.length).toBeGreaterThan(3);
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]).toBeLessThanOrEqual(readings[i - 1] + 1);
    }
    // Genuine progress was displayed mid-route, not a stuck or instant pill.
    expect(Math.min(...readings.slice(0, Math.ceil(readings.length / 2)))).toBeGreaterThan(0);
    expect(readings[readings.length - 1]).toBeLessThan(total * 0.3);

    // Settle on the destination so the smoothed marker converges inside the
    // strict 15 m arrival radius.
    fire(lab, 5, endMs + 10_000);
    fire(lab, 5, endMs + 20_000);
    fire(lab, 5, endMs + 30_000);
    await waitFor(() => expect(mockSinarms.moveVisitor).toHaveBeenCalledWith('v-tumba-sim', 'it-lab-7', 'gps'));

    fire(lab, 5, endMs + 40_000); // re-render with the arrived visitor
    expect(pillMeters()).toBe(0);
    expect(distanceMeters(visitorMarkerPos(), lab)).toBeLessThan(12);
    expect(await screen.findByText(/visitor\.nav\.arrived\.title/)).toBeInTheDocument();
    expect(screen.getByText(/visitor\.nav\.arrived\.message IT Lab 7/)).toBeInTheDocument();
  });

  it('walks the longest campus route (gate -> Procurement) without a false auto-checkout', async () => {
    // Geofence ON — harsher than production (where distanceCheckEnabled is
    // false): mid-walk the visitor is briefly >120 m from every mapped node,
    // and only the 30 s debounce stands between that and a wrong checkout.
    setupVisit('office-of-procurement', { distanceCheckEnabled: true });
    const visitor = mockSinarms.currentVisitor;
    const total = routeTotalM(visitor);
    const entrance = nodePos('entrance');
    const office = nodePos('office-of-procurement');

    expect(total).toBeGreaterThan(150); // sanity: this really is the long leg

    render(<MapNavigationPage />);

    fire(entrance, 5, 0);
    expect(pillMeters()).toBe(total);
    expect(screen.getAllByText(/Head [\w-]+ from Main Entrance to Office of the Procurement\./).length).toBeGreaterThan(0);

    const { readings, endMs } = await walkAndSample(entrance, office);
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]).toBeLessThanOrEqual(readings[i - 1] + 1);
    }

    fire(office, 5, endMs + 10_000);
    fire(office, 5, endMs + 20_000);
    fire(office, 5, endMs + 30_000);
    await waitFor(() =>
      expect(mockSinarms.moveVisitor).toHaveBeenCalledWith('v-tumba-sim', 'office-of-procurement', 'gps'),
    );

    fire(office, 5, endMs + 40_000);
    expect(pillMeters()).toBe(0);
    expect(await screen.findByText(/visitor\.nav\.arrived\.title/)).toBeInTheDocument();
    // The whole walk — including the far stretch — never ended the visit.
    expect(mockSinarms.checkoutVisitor).not.toHaveBeenCalled();
  });

  it('routes Server Room -> Administrator Office directly, not as a V via the gate', async () => {
    // Reproduces the walk from the field report: a visitor at the Server Room
    // heading to the Administrator Office. With the old hub-and-spoke graph
    // this routed ~229 m back through the Main Entrance and the drawn path
    // swung on every reroute; the office mesh must make it one direct leg.
    setupVisit('administrator-office', {}, 'server-room');
    const visitor = mockSinarms.currentVisitor;
    expect(visitor.routeNodeIds).toEqual(['server-room', 'administrator-office']);
    const total = routeTotalM(visitor);
    expect(total).toBeLessThan(120); // direct is ~95 m; the V was ~229 m

    const serverRoom = nodePos('server-room');
    const adminOffice = nodePos('administrator-office');

    render(<MapNavigationPage />);

    fire(serverRoom, 5, 0);
    expect(pillMeters()).toBe(total);
    expect(screen.getAllByText(/Head [\w-]+ from Server Room to Administrator Office\./).length).toBeGreaterThan(0);

    const { readings, endMs } = await walkAndSample(serverRoom, adminOffice);
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]).toBeLessThanOrEqual(readings[i - 1] + 1);
    }

    fire(adminOffice, 5, endMs + 10_000);
    fire(adminOffice, 5, endMs + 20_000);
    fire(adminOffice, 5, endMs + 30_000);
    await waitFor(() =>
      expect(mockSinarms.moveVisitor).toHaveBeenCalledWith('v-tumba-sim', 'administrator-office', 'gps'),
    );

    fire(adminOffice, 5, endMs + 40_000);
    expect(pillMeters()).toBe(0);
    expect(await screen.findByText(/visitor\.nav\.arrived\.title/)).toBeInTheDocument();
  });

  it('shows no phantom progress for a stationary coarse fix at the Tumba gate', async () => {
    setupVisit('library');
    const total = routeTotalM(mockSinarms.currentVisitor);
    const entrance = nodePos('entrance');

    render(<MapNavigationPage />);

    // Laptop-grade positioning: ±300 m covers the whole campus.
    fire(entrance, 300, 0);
    expect(pillMeters()).toBe(total);

    // The reported fix wanders across real campus buildings while the visitor
    // stands still at the gate.
    fire(nodePos('it-lab-1'), 300, 10_000);
    fire(nodePos('library'), 300, 20_000);
    fire(nodePos('clinic'), 300, 30_000);
    fire(nodePos('main-hall'), 300, 40_000);
    await act(async () => {});

    expect(mockSinarms.moveVisitor).not.toHaveBeenCalled();
    expect(pillMeters()).toBe(total);
    expect(mockSinarms.currentVisitor.currentNodeId).toBe('entrance');
    expect(distanceMeters(visitorMarkerPos(), entrance)).toBeLessThan(5);
    expect(screen.queryByText(/visitor\.nav\.arrived\.title/)).not.toBeInTheDocument();
  });
});
