import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVenue } from '../../context/VenueContext';

const tabs = [
  { to: '/staff/dashboard', label: 'Home', icon: '🏠' },
  { to: '/staff/tasks', label: 'Tasks', icon: '📋' },
  { to: '/staff/leaderboard', label: 'Board', icon: '🏆' },
  { to: '/staff/rewards', label: 'Rewards', icon: '🎁' },
  { to: '/staff/profile', label: 'Profile', icon: '👤' },
];

export default function StaffLayout() {
  const { profile } = useAuth();
  const { venue, settings } = useVenue();
  const location = useLocation();

  // BUG-12: Redirect to profile setup on first login (no avatar set)
  const needsSetup = profile && !profile.avatar_type && location.pathname !== '/staff/profile';

  if (needsSetup) {
    return <Navigate to="/staff/profile" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          )}
          <h1 className="text-lg font-bold text-primary">{venue?.name || 'Bar Chores'} <span className="text-xs text-slate-500 font-normal">v{__APP_VERSION__}</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-accent font-medium">
            {profile?.points_total ?? 0} pts
          </span>
        </div>
      </header>

      {/* First-login banner — tell user exactly what's missing */}
      {profile && !profile.avatar_type && (
        <div className="bg-accent/10 border-b border-accent/30 px-4 py-3 text-center text-sm text-accent space-y-1">
          <p className="font-medium">Welcome! Please complete your profile:</p>
          <p>1. Choose an avatar (build one or upload a photo)</p>
          <p>2. Change your PIN to something personal</p>
          <p className="text-xs text-slate-400 mt-1">You'll be logged out after saving so you can sign in with your new PIN.</p>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex justify-around py-2 z-50">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 min-w-[48px] min-h-[48px] justify-center transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px]">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
