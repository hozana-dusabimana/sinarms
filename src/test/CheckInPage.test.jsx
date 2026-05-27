import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockSinarms = null;
let navigateMock = null;

vi.mock('../context/SinarmsContext', () => ({
  useSinarms: () => mockSinarms,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import CheckInPage from '../pages/visitor/CheckInPage';

function buildState({ withLocations = true } = {}) {
  if (!withLocations) {
    return { organizations: [], locations: [], maps: {} };
  }

  return {
    organizations: [{ id: 'org-1', name: 'Ruliba Clays Ltd', status: 'active' }],
    locations: [{ id: 'loc-1', organizationId: 'org-1', name: 'Head Office - Kigali', status: 'active' }],
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

describe('CheckInPage', () => {
  beforeEach(() => {
    navigateMock = vi.fn();
    mockSinarms = {
      state: buildState(),
      classifyVisitorDestination: vi.fn(),
      registerVisitor: vi.fn().mockResolvedValue({ id: 'visitor-1' }),
    };
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders location select and destination select, and can submit using a selected destination', async () => {
    const user = userEvent.setup();
    render(<CheckInPage />);

    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('ID or Phone')).toBeInTheDocument();
    expect(screen.getByText(/Where are you going\?/i)).toBeInTheDocument();

    const locationSelect = screen.getByText('Location').parentElement.querySelector('select');
    expect(locationSelect).toBeTruthy();
    expect(screen.getByText('Ruliba Clays Ltd | Head Office - Kigali')).toBeInTheDocument();

    const destinationSelect = screen.getByText(/Where are you going\?/i).parentElement.querySelector('select');
    expect(destinationSelect).toBeTruthy();

    const nameInput = screen.getByText('Full Name').parentElement.querySelector('input');
    const idInput = screen.getByText('ID or Phone').parentElement.querySelector('input');
    expect(nameInput).toBeTruthy();
    expect(idInput).toBeTruthy();

    await user.type(nameInput, 'John Doe');
    await user.type(idInput, '0788000000');
    await user.selectOptions(destinationSelect, 'finance-office');

    await user.click(screen.getByRole('button', { name: /Start Navigation/i }));

    expect(mockSinarms.classifyVisitorDestination).not.toHaveBeenCalled();
    expect(mockSinarms.registerVisitor).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/visit/navigate', { state: { visitorId: 'visitor-1' } });
  });

  it('shows a textarea when destination is set to Other (type it)', async () => {
    const user = userEvent.setup();
    render(<CheckInPage />);

    const destinationSelect = screen.getByText(/Where are you going\?/i).parentElement.querySelector('select');
    await user.selectOptions(destinationSelect, 'other');

    expect(screen.getByPlaceholderText(/e\.g\./i)).toBeInTheDocument();
  });

  it('alerts if submitting before locations are loaded', async () => {
    mockSinarms.state = buildState({ withLocations: false });
    render(<CheckInPage />);

    fireEvent.submit(screen.getByRole('button', { name: /Start Navigation/i }).closest('form'));
    expect(window.alert).toHaveBeenCalled();
    expect(String(window.alert.mock.calls[0][0])).toMatch(/loading locations/i);
  });
});
