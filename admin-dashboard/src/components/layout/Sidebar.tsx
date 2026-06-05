import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Users2, Wifi, Swords,
  Trophy, Bell, Activity, LogOut, Gamepad2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../features/auth/hooks/useAuth';

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/players',      icon: Users,            label: 'Players' },
  { to: '/friends',      icon: Users2,           label: 'Friends' },
  { to: '/presence',     icon: Wifi,             label: 'Presence' },
  { to: '/matches',      icon: Swords,           label: 'Matches' },
  { to: '/leaderboards', icon: Trophy,           label: 'Leaderboards' },
  { to: '/notifications',icon: Bell,             label: 'Notifications' },
  { to: '/health',       icon: Activity,         label: 'System Health' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/20">
          <Gamepad2 size={16} className="text-accent" />
        </div>
        <span className="text-sm font-semibold text-[#e6edf3]">Playnet</span>
        <span className="ml-auto rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted hover:bg-card hover:text-[#e6edf3]'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
            {user?.username?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <span className="flex-1 truncate text-xs text-muted">{user?.username ?? 'admin'}</span>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-card hover:text-danger transition-colors"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </aside>
  );
}
