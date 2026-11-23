import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tenantAccess } from '../lib/tenants';
import AccessLocked from './AccessLocked';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, userProfile, loading } = useAuth();

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(userProfile?.role)) {
    return <Navigate to="/login" replace />;
  }
  // Tenants whose demo/subscription has ended (or who are suspended) can't use the app.
  if (userProfile?.role !== 'ceo') {
    const access = tenantAccess(userProfile);
    if (access.locked) return <AccessLocked access={access} />;
  }
  return children;
}
