import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
    t: (key) => key,
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

import CheckInPage from '../pages/visitor/CheckInPage';

// One of Ruliba's surveyed GPS pins from seed.js — close to the seeded
// entrance node, well within the 100 m geofence.
const NEAR_LAT = -1.949983;
const NEAR_LNG = 30.229861;
// Several km away (a different part of Kigali) — should trigger out-of-range.
const FAR_LAT = -1.94;
const FAR_LNG = 30.10;

function buildState() {
  return {
    organizations: [{ id: 'org-1', name: 'Ruliba Clays Ltd', status: 'active' }],
    locations: [
      { id: 'loc-1', organizationId: 'org-1', name: 'Main Site', status: 'active' },
    ],
    maps: {
      'loc-1': {
        nodes: [
          { id: 'entrance', label: 'Entrance', type: 'checkpoint', lat: NEAR_LAT, lng: NEAR_LNG },
          { id: 'office', label: 'Office', type: 'office' },
        ],
        edges: [],
      },
    },
  };
}

function installGeolocation({ coords, error }) {
  const watchPosition = vi.fn((onSuccess, onError) => {
    if (coords) onSuccess({ coords });
    else if (error) onError(error);
    return 1;
  });
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch: vi.fn() },
    configurable: true,
    writable: true,
  });
  return watchPosition;
}

describe('CheckInPage geofence banner', () => {
  beforeEach(() => {
    mockSinarms = {
      state: buildState(),
      classifyVisitorDestination: vi.fn(),
      registerVisitor: vi.fn().mockResolvedValue({ id: 'visitor-1' }),
      qrCheckin: vi.fn(),
      isReady: true,
    };
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    // Unmount BEFORE we strip navigator.geolocation, so the CheckInPage
    // GPS-watcher cleanup doesn't crash on undefined.geolocation.clearWatch.
    cleanup();
    delete navigator.geolocation;
    vi.restoreAllMocks();
  });

  // The redesigned CheckInPage routes banner copy through t(), and the mocked
  // useLanguage returns the translation key verbatim. We match on those keys.

  it('shows the out-of-range warning when GPS reports a far position', async () => {
    installGeolocation({ coords: { latitude: FAR_LAT, longitude: FAR_LNG } });
    render(<CheckInPage />);
    expect(await screen.findByText('visitor.checkin.outOfRange')).toBeInTheDocument();
  });

  it('shows the in-range banner when GPS is at the entrance', async () => {
    installGeolocation({ coords: { latitude: NEAR_LAT, longitude: NEAR_LNG } });
    render(<CheckInPage />);
    expect(await screen.findByText('visitor.checkin.inRange')).toBeInTheDocument();
  });

  it('shows the location-off banner when GPS permission is denied', async () => {
    installGeolocation({ error: { code: 1, message: 'Permission denied' } });
    render(<CheckInPage />);
    expect(await screen.findByText('visitor.checkin.locationOff')).toBeInTheDocument();
  });

  it('shows the location-off banner when the browser has no geolocation API', async () => {
    // Simulate a browser without navigator.geolocation by deleting it.
    delete navigator.geolocation;
    render(<CheckInPage />);
    expect(await screen.findByText('visitor.checkin.locationOff')).toBeInTheDocument();
  });
});
