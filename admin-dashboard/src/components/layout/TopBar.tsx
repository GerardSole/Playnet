import { useLocation } from 'react-router-dom';

const TITLES: Record<string, string> = {
  '/':              'Dashboard',
  '/players':       'Players',
  '/friends':       'Friends',
  '/presence':      'Presence',
  '/matches':       'Matches',
  '/leaderboards':  'Leaderboards',
  '/notifications': 'Notifications',
  '/health':        'System Health',
};

export function TopBar() {
  const { pathname } = useLocation();
  const base = '/' + pathname.split('/')[1];
  const title = TITLES[base] ?? 'Admin';

  return (
    <header className="flex h-14 items-center border-b border-border bg-main px-6">
      <h1 className="text-sm font-medium text-[#e6edf3]">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-online animate-pulse" />
        <span className="text-xs text-muted">Backend conectado</span>
      </div>
    </header>
  );
}
