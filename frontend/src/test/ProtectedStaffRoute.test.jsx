import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

let mockSinarms = null;

vi.mock('../context/SinarmsContext', () => ({
  useSinarms: () => mockSinarms,
}));

import ProtectedStaffRoute from '../components/auth/ProtectedStaffRoute';

function renderRoutes({ adminOnly }) {
  return render(
    <MemoryRouter initialEntries={['/staff/admin']}>
      <Routes>
        <Route element={<ProtectedStaffRoute adminOnly={adminOnly} />}>
          <Route path="/staff/admin" element={<div>Admin Area</div>} />
        </Route>
        <Route path="/staff/dashboard" element={<div>Staff Dashboard</div>} />
        <Route path="/staff/login" element={<div>Staff Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedStaffRoute', () => {
  beforeEach(() => {
    mockSinarms = {
      authResolved: true,
      currentUser: null,
    };
  });

  it('redirects unauthenticated users to /staff/login', async () => {
    renderRoutes({ adminOnly: false });
    expect(await screen.findByText('Staff Login')).toBeInTheDocument();
  });

  it('redirects receptionist away from admin-only route', async () => {
    mockSinarms.currentUser = { id: 'u1', role: 'receptionist' };
    renderRoutes({ adminOnly: true });
    expect(await screen.findByText('Staff Dashboard')).toBeInTheDocument();
  });

  it('allows admin into admin-only route', async () => {
    mockSinarms.currentUser = { id: 'u1', role: 'admin' };
    renderRoutes({ adminOnly: true });
    expect(await screen.findByText('Admin Area')).toBeInTheDocument();
  });
});

