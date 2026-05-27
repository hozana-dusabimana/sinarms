import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockSinarms = null;
const apiGet = vi.fn();

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

    expect(await screen.findByText('10')).toBeInTheDocument();
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

    // Click the date range button to cycle to "Last 7 Days".
    await user.click(screen.getByRole('button', { name: /Last 30 Days/i }));

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/analytics/summary', { params: { days: 7 } });
    });

    expect(await screen.findByText('7')).toBeInTheDocument();
  });
});

