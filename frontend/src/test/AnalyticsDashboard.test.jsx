import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockSinarms = null;
// vi.mock is hoisted above all top-level statements, so the mock factory can't
// reference normally-declared variables (they're still in the TDZ). vi.hoisted
// runs alongside the mocks so apiGet is available when the factory executes.
const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('../context/SinarmsContext', () => ({
  useSinarms: () => mockSinarms,
}));

vi.mock('../lib/api', () => ({
  default: {
    get: apiGet,
  },
}));

import AnalyticsDashboard from '../pages/admin/AnalyticsDashboard';

function analyticsSnapshot(overrides = {}) {
  return {
    totalVisitors: 0,
    activeVisitors: 0,
    averageDuration: 0,
    alertsToday: 0,
    topDestinations: [],
    arrivalsByDay: [],
    ...overrides,
  };
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    apiGet.mockReset();
    mockSinarms = {
      analytics: analyticsSnapshot(),
      exportAnalytics: vi.fn(),
    };
  });

  it('renders and loads analytics summary from the API', async () => {
    apiGet.mockResolvedValueOnce({
      data: analyticsSnapshot({
        totalVisitors: 10,
        activeVisitors: 2,
        averageDuration: 18,
        alertsToday: 1,
        arrivalsByDay: [{ date: '2026-03-10', totalVisitors: 10 }],
        topDestinations: [{ label: 'Finance Office', total: 6 }],
      }),
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByText('Analytics Overview')).toBeInTheDocument();
    expect(screen.getByText('Visitor Volume Trend')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/analytics/summary', { params: { days: 30 } });
    });

    // "10" renders both in the Total Visitors card and as a bar-chart tooltip,
    // so use findAllByText and just confirm at least one is on the page.
    const tens = await screen.findAllByText('10');
    expect(tens.length).toBeGreaterThan(0);
    expect(screen.getByText('Finance Office')).toBeInTheDocument();
  });

  it('reloads analytics when switching date range', async () => {
    apiGet
      .mockResolvedValueOnce({ data: analyticsSnapshot({ totalVisitors: 30, arrivalsByDay: [] }) })
      .mockResolvedValueOnce({ data: analyticsSnapshot({ totalVisitors: 7, arrivalsByDay: [] }) });

    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/analytics/summary', { params: { days: 30 } });
    });

    // Cycle the date range. The button advances 30 → 90 → 7 → 30, so one
    // click takes us to "Last 90 Days" / days: 90.
    await user.click(screen.getByRole('button', { name: /Last 30 Days/i }));

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/analytics/summary', { params: { days: 90 } });
    });

    // "7" appears in the SVG/text in multiple places (e.g. tooltips); just
    // confirm the new totalVisitors landed on the page.
    const sevens = await screen.findAllByText('7');
    expect(sevens.length).toBeGreaterThan(0);
  });
});

