import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVenue } from '../../context/VenueContext';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/users', label: 'Staff', icon: '👥' },
  { to: '/admin/tasks', label: 'Tasks', icon: '📋' },
  { to: '/admin/assignments', label: 'Assignments', icon: '✅' },
  { to: '/admin/rewards', label: 'Rewards', icon: '🎁' },
  { to: '/admin/theme', label: 'Theme', icon: '🎨' },
];

export default function AdminLayout() {
  const { profile, logout } = useAuth();
  const { venue, settings } = useVenue();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2 min-w-0">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          )}
          <h1 className="text-lg font-bold text-primary truncate">
            {venue?.name || 'Bar Chores'} <span className="text-xs text-slate-500 font-normal">v{__APP_VERSION__}</span>
          </h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-700 px-4 py-2 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <div className="pt-2 mt-2 border-t border-slate-700">
            <p className="text-sm text-slate-400 truncate px-3 mb-2">{profile?.email}</p>
            <button
              onClick={() => { logout(); setMobileMenuOpen(false); }}
              className="w-full px-3 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-left"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-700 flex-col min-h-screen">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {settings?.logo_url && (
              <img src={settings.logo_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-primary truncate">
                {venue?.name || 'Bar Chores'} <span className="text-xs text-slate-500 font-normal">v{__APP_VERSION__}</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <p className="text-sm text-slate-400 truncate mb-2">{profile?.email}</p>
          <button
            onClick={logout}
            className="w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            Sign Out
          </button>
          <p className="text-xs text-slate-500 text-center mt-3">v{__APP_VERSION__}</p>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex justify-around py-2 z-50">
        {navItems.slice(0, 5).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 min-w-[48px] min-h-[48px] justify-center transition-colors ${
                isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
