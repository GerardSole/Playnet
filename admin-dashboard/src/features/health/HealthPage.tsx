import { CheckCircle, XCircle, Clock, Tag, RefreshCw, Database, Layers, Wifi } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useHealth } from './hooks/useHealth';
import { formatUptime } from '../../lib/utils';

interface ServiceCardProps {
  name: string;
  status: 'ok' | 'error' | undefined;
  icon: LucideIcon;
  description: string;
}

function ServiceCard({ name, status, icon: Icon, description }: ServiceCardProps) {
  const ok = status === 'ok';
  return (
    <div className={`rounded-lg border p-5 ${ok ? 'border-border bg-card' : 'border-danger/30 bg-danger/5'}`}>
      <div className="flex items-start justify-between">
        <div className={`rounded-md p-2 ${ok ? 'bg-main text-muted' : 'bg-danger/10 text-danger'}`}>
          <Icon size={18} />
        </div>
        {ok
          ? <CheckCircle size={18} className="text-online" />
          : <XCircle size={18} className="text-danger" />}
      </div>
      <div className="mt-3">
        <h3 className="font-medium text-[#e6edf3]">{name}</h3>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <div className="mt-3">
        <StatusBadge status={ok ? 'ok' : 'error'} />
      </div>
    </div>
  );
}

export function HealthPage() {
  const { data, isLoading, dataUpdatedAt, refetch } = useHealth();
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-US') : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description={`Last updated: ${lastUpdate} · Refreshes every 10 s`}
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted hover:text-[#e6edf3] transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Overall status */}
      <div className={`rounded-lg border px-5 py-4 flex items-center gap-4 ${
        !data ? 'border-border bg-card' :
        data.status === 'ok' ? 'border-online/30 bg-online/5' : 'border-pending/30 bg-pending/5'
      }`}>
        {!data ? (
          <span className="text-sm text-muted">{isLoading ? 'Connecting to backend…' : 'Backend unavailable'}</span>
        ) : (
          <>
            <StatusBadge status={data.status} />
            <span className="text-sm text-muted">
              {data.status === 'ok' ? 'All services operational' : 'Degradation detected in one or more services'}
            </span>
          </>
        )}
      </div>

      {/* Service cards */}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ServiceCard
            name="PostgreSQL"
            status={data.services.postgres}
            icon={Database}
            description="Main database — users, tokens, matches"
          />
          <ServiceCard
            name="Redis"
            status={data.services.redis}
            icon={Layers}
            description="Cache, rate limiting and session pub/sub"
          />
          <ServiceCard
            name="Socket Adapter"
            status={data.services.socketAdapter}
            icon={Wifi}
            description="Redis adapter for multi-instance Socket.IO"
          />
        </div>
      )}

      {/* Metadata */}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted mb-2">
              <Clock size={14} /> <span className="text-xs">Uptime</span>
            </div>
            <p className="text-2xl font-semibold text-[#e6edf3]">{formatUptime(data.uptime)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted mb-2">
              <Tag size={14} /> <span className="text-xs">Version</span>
            </div>
            <p className="font-mono text-2xl font-semibold text-[#e6edf3]">v{data.version}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted mb-2">
              <RefreshCw size={14} /> <span className="text-xs">Timestamp</span>
            </div>
            <p className="font-mono text-xs text-[#e6edf3] mt-2">{data.timestamp}</p>
          </div>
        </div>
      )}
    </div>
  );
}
