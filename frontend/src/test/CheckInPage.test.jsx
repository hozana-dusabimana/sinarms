import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockSinarms = null;
let navigateMock = null;

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
    // t returns the key so we can match by translation key in assertions.
    t: (key) => key,
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

import CheckInPage from '../pages/visitor/CheckInPage';

function buildState({ withLocations = true } = {}) {
  if (!withLocations) {
    return { organizations: [], locations: [], maps: {} };
  }

  return {
    organizations: [{ id: 'org-1', name: 'Ruliba Clays Ltd', status: 'active' }],
    locations: [
      { id: 'loc-1', organizationId: 'org-1', name: 'Head Office - Kigali', status: 'active' },
    ],
    maps: {
      'loc-1': {
        nodes: [
          { id: 'finance-office', label: 'Finance Office', type: 'office' },
          { id: 'hr-office', label: 'HR Office 104', type: 'office' },
          { id: 'entrance', label: 'Entrance', type: 'checkpoint' },
          { id: 'exit', label: 'Exit', type: 'exit' },
        ],
        edges: [],
      },
    },
  };
}

// We never want the proximity gate to interfere with these legacy happy-path
// tests. We install a stub geolocation that immediately reports a permission
// error — that's the "Location access is off" branch in the component, which
// permits self check-in and sends null GPS coords.
function disableGeolocation() {
  const watchPosition = vi.fn((_onSuccess, onError) => {
    if (onError) onError({ code: 1, message: 'Permission denied' });
    return 1;
  });
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch: vi.fn() },
    configurable: true,
    writable: true,
  });
}

async function clickNextWhenEnabled() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /visitor\.checkin\.next/i })).not.toBeDisabled();
  });
  fireEvent.click(screen.getByRole('button', { name: /visitor\.checkin\.next/i }));
}

// The redesigned page renders some translation keys (e.g. the step title)
// twice — once as the page header and once as the field label. Find the
// `<label>` element specifically.
function findLabelInputByKey(key) {
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((el) => el.textContent.trim() === key);
  if (!label) throw new Error(`No <label> with text ${key}`);
  return label.parentElement.querySelector('input');
}

describe('CheckInPage', () => {
  beforeEach(() => {
    disableGeolocation();
    navigateMock = vi.fn();
    mockSinarms = {
      state: buildState(),
      classifyVisitorDestination: vi.fn(),
      registerVisitor: vi.fn().mockResolvedValue({ id: 'visitor-1' }),
      qrCheckin: vi.fn(),
      isReady: true,
    };
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  // Note: we don't `delete navigator.geolocation` between tests because the
  // CheckInPage's GPS-watcher cleanup runs at unmount and would crash on a
  // missing property. beforeEach re-installs the stub afresh each test.

  // We use fireEvent throughout instead of userEvent because the combination
  // of React 19 + the framer-motion stub mangles userEvent's synthetic events
  // and the controlled inputs never receive their onChange. fireEvent fires
  // the underlying DOM event directly and reaches React's normal handlers.

  it('renders location select on step 1 and lets you submit a selected destination', async () => {
    render(<CheckInPage />);

    // Step 1: location select is visible and pre-populated.
    expect(screen.getByText('Ruliba Clays Ltd | Head Office - Kigali')).toBeInTheDocument();
    await clickNextWhenEnabled();

    // Step 2: fill name + id. waitFor awaits the step transition (the label
    // appears once we reach step 1).
    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('label')).some(
          (el) => el.textContent.trim() === 'visitor.checkin.fullName',
        ),
      ).toBe(true);
    });
    fireEvent.input(findLabelInputByKey('visitor.checkin.fullName'), { target: { value: 'John Doe' } });
    fireEvent.input(findLabelInputByKey('visitor.checkin.idOrPhone'), { target: { value: '0788000000' } });

    await clickNextWhenEnabled();

    // Step 3: destination select.
    const destinationSelect = await screen.findByRole('combobox');
    fireEvent.change(destinationSelect, { target: { value: 'finance-office' } });

    fireEvent.click(await screen.findByRole('button', { name: /visitor\.checkin\.start/i }));

    await waitFor(() => {
      expect(mockSinarms.registerVisitor).toHaveBeenCalled();
    });
    expect(mockSinarms.classifyVisitorDestination).not.toHaveBeenCalled();
    expect(mockSinarms.registerVisitor).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Doe',
        idOrPhone: '0788000000',
        destinationNodeId: 'finance-office',
        source: 'self',
        // GPS denied path sends null coords.
        gpsLat: null,
        gpsLng: null,
      }),
    );
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/visit/navigate', { state: { visitorId: 'visitor-1' } });
    });
  });

  it('shows a textarea when destination is set to Other (type it)', async () => {
    render(<CheckInPage />);

    await clickNextWhenEnabled();
    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('label')).some(
          (el) => el.textContent.trim() === 'visitor.checkin.fullName',
        ),
      ).toBe(true);
    });
    fireEvent.input(findLabelInputByKey('visitor.checkin.fullName'), { target: { value: 'John Doe' } });
    fireEvent.input(findLabelInputByKey('visitor.checkin.idOrPhone'), { target: { value: '0788000000' } });
    await clickNextWhenEnabled();

    const destinationSelect = await screen.findByRole('combobox');
    fireEvent.change(destinationSelect, { target: { value: 'other' } });

    // The "Other" branch renders a textarea below the select.
    await waitFor(() => {
      expect(document.querySelector('textarea')).toBeInTheDocument();
    });
  });

  it('does not advance from step 1 when no locations are loaded', () => {
    // With no active locations the wizard cannot satisfy step 1's
    // selectedLocationId check, so the "Next" button stays disabled and we
    // never reach the submit. Asserting we stayed on step 1 captures that.
    mockSinarms.state = buildState({ withLocations: false });
    render(<CheckInPage />);

    const nextButton = screen.getByRole('button', { name: /visitor\.checkin\.next/i });
    expect(nextButton).toBeDisabled();
  });
});
