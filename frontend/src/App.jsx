import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedStaffRoute from './components/auth/ProtectedStaffRoute';
import StaffLayout from './layouts/StaffLayout';
import VisitorLayout from './layouts/VisitorLayout';
import LandingPage from './pages/LandingPage';
import PublicFaqPage from './pages/PublicFaqPage';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';
import AuditLog from './pages/admin/AuditLog';
import FacilityMapEditor from './pages/admin/FacilityMapEditor';
import FaqManagement from './pages/admin/FaqManagement';
import OrganizationSettings from './pages/admin/OrganizationSettings';
import ReportsPage from './pages/admin/ReportsPage';
import UserManagement from './pages/admin/UserManagement';
import DashboardPage from './pages/staff/DashboardPage';
import LoginPage from './pages/staff/LoginPage';
import ProfilePage from './pages/staff/ProfilePage';
import VisitorHistoryPage from './pages/staff/VisitorHistoryPage';
import StaffFeedbackPage from './pages/staff/FeedbackPage';
import CheckInPage from './pages/visitor/CheckInPage';
import CheckoutPage from './pages/visitor/CheckoutPage';
import FeedbackPage from './pages/visitor/FeedbackPage';
import MapNavigationPage from './pages/visitor/MapNavigationPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/faq" element={<PublicFaqPage />} />
        <Route path="/visit" element={<VisitorLayout />}>
          <Route index element={<CheckInPage />} />
          <Route path="navigate" element={<MapNavigationPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="feedback" element={<FeedbackPage />} />
        </Route>
        <Route path="/staff/login" element={<LoginPage />} />
        <Route element={<ProtectedStaffRoute />}>
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="history" element={<VisitorHistoryPage />} />
            <Route path="feedback" element={<StaffFeedbackPage />} />
            <Route path="faq" element={<FaqManagement />} />
            <Route element={<ProtectedStaffRoute adminOnly />}>
              <Route path="map-editor" element={<FacilityMapEditor />} />
              <Route path="organizations" element={<OrganizationSettings />} />
              <Route path="analytics" element={<AnalyticsDashboard />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="audit-log" element={<AuditLog />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
