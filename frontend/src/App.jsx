import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import VisitorLayout from './layouts/VisitorLayout';
import StaffLayout from './layouts/StaffLayout';
import LandingPage from './pages/LandingPage';
import CheckInPage from './pages/visitor/CheckInPage';
import MapNavigationPage from './pages/visitor/MapNavigationPage';
import CheckoutPage from './pages/visitor/CheckoutPage';
import LoginPage from './pages/staff/LoginPage';
import DashboardPage from './pages/staff/DashboardPage';
import FacilityMapEditor from './pages/admin/FacilityMapEditor';
import OrganizationSettings from './pages/admin/OrganizationSettings';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';
import UserManagement from './pages/admin/UserManagement';
import FaqManagement from './pages/admin/FaqManagement';
import AuditLog from './pages/admin/AuditLog';

function App() {
  return (
    <Router>
      <Routes>
        {/* Global Landing App Portal */}
        <Route path="/" element={<LandingPage />} />

        {/* Visitor Routes (Mobile-First) */}
        <Route path="/visit" element={<VisitorLayout />}>
          <Route index element={<CheckInPage />} />
          <Route path="navigate" element={<MapNavigationPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
        </Route>

        {/* Isolated Staff Login */}
        <Route path="/staff/login" element={<LoginPage />} />

        {/* Staff Routes (Desktop-Optimized) */}
        <Route path="/staff" element={<StaffLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="map-editor" element={<FacilityMapEditor />} />
          <Route path="organizations" element={<OrganizationSettings />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="faq" element={<FaqManagement />} />
          <Route path="audit-log" element={<AuditLog />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
