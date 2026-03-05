import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AdminLayout from './components/admin/AdminLayout';
import StaffLayout from './components/staff/StaffLayout';
import RequireAuth from './components/shared/RequireAuth';

// Super Admin
import SuperAdminLogin from './pages/superadmin/SuperAdminLogin';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';

// Admin
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTasks from './pages/admin/AdminTasks';
import AdminAssignments from './pages/admin/AdminAssignments';
import AdminRewards from './pages/admin/AdminRewards';
import AdminTheme from './pages/admin/AdminTheme';

// Staff
import StaffLogin from './pages/staff/StaffLogin';
import StaffDashboard from './pages/staff/StaffDashboard';
import StaffTasks from './pages/staff/StaffTasks';
import StaffLeaderboard from './pages/staff/StaffLeaderboard';
import StaffRewards from './pages/staff/StaffRewards';
import StaffProfile from './pages/staff/StaffProfile';

// Auth
import AuthCallback from './pages/auth/AuthCallback';
import SetPassword from './pages/auth/SetPassword';
import ForgotPassword from './pages/auth/ForgotPassword';

// Shared
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/staff-login" element={<StaffLogin />} />
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/set-password" element={<SetPassword />} />
      <Route path="/auth/forgot-password" element={<ForgotPassword />} />

      {/* Super Admin */}
      <Route path="/superadmin" element={
        <RequireAuth allowedRoles={['super_admin']}>
          <SuperAdminDashboard />
        </RequireAuth>
      } />

      {/* Admin Panel — nested layout */}
      <Route path="/admin" element={
        <RequireAuth allowedRoles={['venue_admin']}>
          <AdminLayout />
        </RequireAuth>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="rewards" element={<AdminRewards />} />
        <Route path="theme" element={<AdminTheme />} />
      </Route>

      {/* Staff Panel — nested layout */}
      <Route path="/staff" element={
        <RequireAuth allowedRoles={['staff']}>
          <StaffLayout />
        </RequireAuth>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StaffDashboard />} />
        <Route path="tasks" element={<StaffTasks />} />
        <Route path="leaderboard" element={<StaffLeaderboard />} />
        <Route path="rewards" element={<StaffRewards />} />
        <Route path="profile" element={<StaffProfile />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
