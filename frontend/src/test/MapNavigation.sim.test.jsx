import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { distanceMeters } from '../lib/geo';

// Full navigation simulation: render MapNavigationPage with a mocked Leaflet
// layer and a scripted GPS stream, then walk a visitor along a two-edge route
// (entrance -> reception -> office, 65 m total). Asserts the two things a
// visitor actually watches:
//   1. the blue "you are here" marker follows genuine movement, and
//   2. the remaining-distance pill counts down only with genuine movement —
//      a stationary coarse fix (laptop Wi-Fi positioning) must not advance
//      waypoints or shrink the distance (regression for the phantom-progress
//      bug where every route immediately fell from ~44 m to ~9 m).

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
// Marker exposes its position so the test can track the visitor dot.
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

// Offset a [lat,lng] by roughly metresN north / metresE east.
function offset([lat, lng], metresN, metresE) {
  const dLat = metresN / 111320;
  const dLng = metresE / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

// A north-running spine like the seeded sites: entrance at the gate, reception
// 35 m in, office another 30 m on. Legs are far enough apart that reaching one
// waypoint can never bleed into the 15 m arrival radius of the next.
const ENTRANCE = [-1.930023, 30.070365];
const RECEPTION = offset(ENTRANCE, 35, 0);
const OFFICE = offset(RECEPTION, 30, 0);
// Between entrance and reception: inside a widened coarse-fix snap radius of
// reception, but far outside the office's strict 15 m arrival radius.
const MIDWAY = offset(ENTRANCE, 20, 0);

function buildState() {
  return {
    organizations: [{ id: 'org-1', name: 'Qonics Inc', status: 'active', distanceCheckEnabled: true }],
    locations: [{ id: 'loc-1', organizationId: 'org-1', name: 'Head Office', status: 'active' }],
    maps: {
      'loc-1': {
        floorplanImage: null,
        nodes: [
          { id: 'entrance', label: 'Main Entrance', type: 'checkpoint', zone: 'public', lat: ENTRANCE[0], lng: ENTRANCE[1], x: 50, y: 90 },
          { id: 'reception', label: 'Reception', type: 'office', zone: 'public', lat: RECEPTION[0], lng: RECEPTION[1], x: 50, y: 50 },
          { id: 'office', label: 'Manager Office', type: 'office', zone: 'public', lat: OFFICE[0], lng: OFFICE[1], x: 50, y: 20 },
        ],
        edges: [
          { id: 'e1', from: 'entrance', to: 'reception', distanceM: 35, direction: 'straight', directionHint: 'Walk to Reception.', isAccessible: true },
          { id: 'e2', from: 'reception', to: 'office', distanceM: 30, direction: 'straight', directionHint: 'Continue to the Manager Office.', isAccessible: true },
        ],
      },
    },
    visitors: [],
    visitorPositions: [],
    alerts: [],
    notifications: [],
  };
}

function buildVisitor() {
  return {
    id: 'v1',
    name: 'Sim Visitor',
    status: 'active',
    locationId: 'loc-1',
    currentNodeId: 'entrance',
    destinationNodeId: 'office',
    routeNodeIds: ['entrance', 'reception', 'office'],
    routeSteps: [
      { step: 1, nodeId: 'reception', instruction: 'Walk to Reception.', distanceM: 35, direction: 'straight' },
      { step: 2, nodeId: 'office', instruction: 'Continue to the Manager Office.', distanceM: 30, direction: 'straight' },
    ],
  };
}

// --- GPS simulation harness (same pattern as useGeolocation.sim.test.jsx) ---
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
    act(() => {
      cb({ coords: { latitude: coords[0], longitude: coords[1], accuracy }, timestamp: BASE_TS + tOffsetMs });
    });
  };
}

function visitorMarkerPos() {
  const markers = [...document.querySelectorAll('[data-marker]')];
  const dot = markers.find((m) => m.textContent.includes('visitor.nav.youAreHere'));
  return dot ? JSON.parse(dot.getAttribute('data-position')) : null;
}

function pillMeters() {
  const pill = document.querySelector('div.bottom-4');
  const match = pill?.textContent.match(/visitor\.nav\.metersAway (\d+)/);
  return match ? Number(match[1]) : null;
}

describe('MapNavigationPage navigation simulation', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    installGeolocation();
    mockSinarms = {
      state: buildState(),
      currentVisitor: buildVisitor(),
      isReady: true,
      setCurrentVisitor: vi.fn().mockResolvedValue(null),
      checkoutVisitor: vi.fn().mockResolvedValue(null),
      // Mirrors the real context: advancing updates the visitor's currentNodeId.
      moveVisitor: vi.fn((id, nodeId) => {
        mockSinarms.currentVisitor = { ...mockSinarms.currentVisitor, currentNodeId: nodeId };
        return Promise.resolve(mockSinarms.currentVisitor);
      }),
    };
  });

  afterEach(() => {
    cleanup();
    delete navigator.geolocation;
    vi.restoreAllMocks();
  });

  it('moves the marker and counts the distance down as the visitor walks the route', async () => {
    render(<MapNavigationPage />);

    // Standing at the entrance with a phone-grade fix: full route remaining.
    fire(ENTRANCE, 8, 0);
    expect(pillMeters()).toBe(65);
    const startPos = visitorMarkerPos();
    expect(startPos).not.toBeNull();
    expect(distanceMeters(startPos, ENTRANCE)).toBeLessThan(5);
    expect(mockSinarms.moveVisitor).not.toHaveBeenCalled();

    // Walk to Reception. Repeated fixes at the same spot let the smoothing
    // filter confirm the movement and converge (a real receiver does the same).
    fire(RECEPTION, 8, 5_000);
    fire(RECEPTION, 8, 10_000);
    fire(RECEPTION, 8, 15_000);
    fire(RECEPTION, 8, 20_000);
    await waitFor(() => expect(mockSinarms.moveVisitor).toHaveBeenCalledWith('v1', 'reception', 'gps'));
    expect(mockSinarms.moveVisitor).not.toHaveBeenCalledWith('v1', 'office', 'gps');

    // Marker followed the walk; the pill dropped to the remaining leg.
    fire(RECEPTION, 8, 25_000); // re-render with the advanced visitor
    const midPos = visitorMarkerPos();
    expect(distanceMeters(midPos, RECEPTION)).toBeLessThan(12);
    expect(pillMeters()).toBeLessThanOrEqual(30);
    expect(pillMeters()).toBeGreaterThan(0);

    // Walk the final leg. Arrival demands genuine proximity to the office.
    fire(OFFICE, 8, 30_000);
    fire(OFFICE, 8, 35_000);
    fire(OFFICE, 8, 40_000);
    await waitFor(() => expect(mockSinarms.moveVisitor).toHaveBeenCalledWith('v1', 'office', 'gps'));

    fire(OFFICE, 8, 45_000);
    const endPos = visitorMarkerPos();
    expect(distanceMeters(endPos, OFFICE)).toBeLessThan(12);
    expect(pillMeters()).toBe(0);

    // Arrival is announced once the destination node is reached.
    expect(await screen.findByText(/visitor\.nav\.arrived\.title/)).toBeInTheDocument();
  });

  it('does NOT fake progress on a stationary coarse fix (laptop Wi-Fi positioning)', async () => {
    render(<MapNavigationPage />);

    // ±500 m accuracy at the entrance — the whole site fits inside the error
    // radius, exactly the condition that used to walk the route by itself.
    fire(ENTRANCE, 500, 0);
    expect(pillMeters()).toBe(65);

    // The reported fix wanders around the site (10 s apart, plausible speeds).
    fire(RECEPTION, 500, 10_000);
    fire(OFFICE, 500, 20_000);
    fire(RECEPTION, 500, 30_000);
    fire(OFFICE, 500, 40_000);

    // Let any (wrong) async advancement settle before asserting.
    await act(async () => {});

    // No waypoint was "reached", the pill still shows the full route, and the
    // marker held its anchor instead of chasing the noise.
    expect(mockSinarms.moveVisitor).not.toHaveBeenCalled();
    expect(pillMeters()).toBe(65);
    expect(mockSinarms.currentVisitor.currentNodeId).toBe('entrance');
    expect(distanceMeters(visitorMarkerPos(), ENTRANCE)).toBeLessThan(5);
  });

  it('still advances waypoints on widened phone accuracy, but never fakes arrival', async () => {
    // Accuracy 45 m — coarse but real-phone territory, below the 60 m gate.
    // From midway up the path, reception (≈15 m ahead) falls inside the
    // accuracy-widened snap radius, so the intermediate waypoint advances; the
    // office (≈45 m ahead) must stay unreached: arrival requires a strict 15 m.
    render(<MapNavigationPage />);

    fire(MIDWAY, 45, 0);
    await waitFor(() => expect(mockSinarms.moveVisitor).toHaveBeenCalledWith('v1', 'reception', 'gps'));

    fire(MIDWAY, 45, 10_000);
    fire(MIDWAY, 45, 20_000);
    await act(async () => {});

    expect(mockSinarms.moveVisitor).not.toHaveBeenCalledWith('v1', 'office', 'gps');
    expect(mockSinarms.currentVisitor.currentNodeId).toBe('reception');
    expect(pillMeters()).toBe(30);
  });
});
