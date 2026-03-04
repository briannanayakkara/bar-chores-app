import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../lib/logger';
import type { UserRole } from '../../types/database';

interface Props {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export default function RequireAuth({ children, allowedRoles }: Props) {
  const { profile, loading } = useAuth();

  if (loading) {
    logger.nav('RequireAuth: still loading auth state');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Signing in...</p>
      </div>
    );
  }

  if (!profile) {
    logger.nav('RequireAuth: no profile, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    logger.nav(`RequireAuth: role "${profile.role}" not in allowed ${JSON.stringify(allowedRoles)}, redirecting`);
    if (profile.role === 'staff') return <Navigate to="/staff/dashboard" replace />;
    if (profile.role === 'venue_admin') return <Navigate to="/admin/dashboard" replace />;
    if (profile.role === 'super_admin') return <Navigate to="/superadmin" replace />;
    return <Navigate to="/login" replace />;
  }

  logger.nav(`RequireAuth: access granted (role: ${profile.role})`);
  return <>{children}</>;
}
