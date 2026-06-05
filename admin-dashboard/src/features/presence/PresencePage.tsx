import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/Spinner';
import { usePresence } from './hooks/usePresence';
import { formatDateTime, truncateId } from '../../lib/utils';
import type { PresenceEntry } from '../../api/types';

const COLUMNS: Column<PresenceEntry>[] = [
  { header: 'User', accessor: 'username' },
  { header: 'Socket ID', accessor: (p) => <span className="font-mono text-xs">{p.socketId}</span> },
  { header: 'Online since', accessor: (p) => formatDateTime(p.onlineSince) },
  { header: 'Status', accessor: () => <StatusBadge status="online" /> },
];

export function PresencePage() {
  const { data, isLoading, dataUpdatedAt, refetch } = usePresence();

  if (isLoading) return <PageLoader />;

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-US') : '—';

  return (
    <div>
      <PageHeader
        title="Presence"
        description={`${data?.length ?? 0} players connected right now · Updated at ${lastUpdate}`}
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted hover:text-[#e6edf3] transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Live counter */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-online/20 bg-online/5 px-5 py-4">
        <div className="h-3 w-3 rounded-full bg-online animate-pulse" />
        <span className="text-lg font-semibold text-online">{data?.length ?? 0}</span>
        <span className="text-sm text-muted">players online</span>
      </div>

      <DataTable
        columns={COLUMNS}
        data={data ?? []}
        rowKey={(p) => p.userId}
        emptyMessage="No players connected"
      />
    </div>
  );
}
