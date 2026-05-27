import { Navigate, Outlet } from 'react-router-dom';
import { useSinarms } from '../../context/SinarmsContext';

export default function ProtectedStaffRoute({ adminOnly = false }) {
  const { authResolved, currentUser } = useSinarms();

  if (!authResolved) {
    return <div className="p-6 text-sm text-slate-500">Loading staff session...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/staff/login" replace />;
  }

  if (adminOnly && currentUser.role !== 'admin') {
    return <Navigate to="/staff/dashboard" replace />;
  }

  return <Outlet />;
}
