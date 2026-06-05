import { Users, Wifi, Swords, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/ui/StatCard';
import { PageLoader } from '../../components/ui/Spinner';
import { useDashboardStats } from './hooks/useDashboardStats';
import { formatDateTime, formatUptime } from '../../lib/utils';

export function DashboardPage() {
  const { health, isLoading, totalPlayers, onlinePlayers, activeMatches, totalLeaderboards, recentPlayers } = useDashboardStats();

  if (isLoading) return <PageLoader />;

  const serviceOk = (s: 'ok' | 'error' | undefined) => s === 'ok';

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Players" value={totalPlayers} icon={Users} trend="↑ +2 this week" trendUp />
        <StatCard label="Online Now" value={onlinePlayers} icon={Wifi} accent />
        <StatCard label="Active Matches" value={activeMatches} icon={Swords} trend="in progress" />
        <StatCard label="Leaderboards" value={totalLeaderboards} icon={Trophy} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* System Status */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-[#e6edf3]">System Status</h3>
          {health ? (
            <div className="space-y-3">
              {[
                { name: 'PostgreSQL', key: 'postgres' },
                { name: 'Redis', key: 'redis' },
                { name: 'Socket Adapter', key: 'socketAdapter' },
              ].map(({ name, key }) => {
                const ok = serviceOk(health.services[key as keyof typeof health.services]);
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-muted">{name}</span>
                    <div className="flex items-center gap-1.5">
                      {ok
                        ? <CheckCircle size={14} className="text-online" />
                        : <XCircle size={14} className="text-danger" />}
                      <span className={`text-xs ${ok ? 'text-online' : 'text-danger'}`}>
                        {ok ? 'OK' : 'Error'}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 border-t border-border pt-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Uptime</span>
                  <span className="text-[#e6edf3]">{formatUptime(health.uptime)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Version</span>
                  <span className="font-mono text-[#e6edf3]">{health.version}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Backend unavailable</p>
          )}
        </div>

        {/* Recent Players */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#e6edf3]">Recent Players</h3>
            <Link to="/players" className="text-xs text-accent hover:underline">Ver todos →</Link>
          </div>
          <div className="space-y-3">
            {recentPlayers.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent">
                    {p.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-[#e6edf3]">{p.username}</p>
                    <p className="text-xs text-muted">{p.email}</p>
                  </div>
                </div>
                <span className="text-xs text-muted">{formatDateTime(p.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
