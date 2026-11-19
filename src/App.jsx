import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import CEODashboard from './pages/ceo/CEODashboard';
import Tenants from './pages/ceo/Tenants';
import GymDashboard from './pages/gym/GymDashboard';
import Customers from './pages/gym/Customers';
import GymReports from './pages/gym/GymReports';
import PadelDashboard from './pages/padel/PadelDashboard';
import PadelBookings from './pages/padel/PadelBookings';
import PadelCalendar from './pages/padel/PadelCalendar';
import CricketDashboard from './pages/cricket/CricketDashboard';
import CricketBookings from './pages/cricket/CricketBookings';
import CricketCalendar from './pages/cricket/CricketCalendar';

const ROLE_HOME = {
  ceo: '/ceo/dashboard',
  gym: '/gym/dashboard',
  padel: '/padel/dashboard',
  cricket: '/cricket/dashboard',
};

function RootRedirect() {
  const { user, userProfile, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[userProfile?.role] || '/login'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RootRedirect />} />

      <Route path="/ceo/dashboard" element={
        <ProtectedRoute allowedRoles={['ceo']}><Layout><CEODashboard /></Layout></ProtectedRoute>
      } />
      <Route path="/ceo/tenants" element={
        <ProtectedRoute allowedRoles={['ceo']}><Layout><Tenants /></Layout></ProtectedRoute>
      } />

      <Route path="/gym/dashboard" element={
        <ProtectedRoute allowedRoles={['gym']}><Layout><GymDashboard /></Layout></ProtectedRoute>
      } />
      <Route path="/gym/customers" element={
        <ProtectedRoute allowedRoles={['gym']}><Layout><Customers /></Layout></ProtectedRoute>
      } />
      <Route path="/gym/reports" element={
        <ProtectedRoute allowedRoles={['gym']}><Layout><GymReports /></Layout></ProtectedRoute>
      } />

      <Route path="/padel/dashboard" element={
        <ProtectedRoute allowedRoles={['padel']}><Layout><PadelDashboard /></Layout></ProtectedRoute>
      } />
      <Route path="/padel/bookings" element={
        <ProtectedRoute allowedRoles={['padel']}><Layout><PadelBookings /></Layout></ProtectedRoute>
      } />
      <Route path="/padel/calendar" element={
        <ProtectedRoute allowedRoles={['padel']}><Layout><PadelCalendar /></Layout></ProtectedRoute>
      } />

      <Route path="/cricket/dashboard" element={
        <ProtectedRoute allowedRoles={['cricket']}><Layout><CricketDashboard /></Layout></ProtectedRoute>
      } />
      <Route path="/cricket/bookings" element={
        <ProtectedRoute allowedRoles={['cricket']}><Layout><CricketBookings /></Layout></ProtectedRoute>
      } />
      <Route path="/cricket/calendar" element={
        <ProtectedRoute allowedRoles={['cricket']}><Layout><CricketCalendar /></Layout></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
