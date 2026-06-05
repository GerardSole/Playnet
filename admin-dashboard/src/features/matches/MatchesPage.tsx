import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useMatches } from './hooks/useMatches';
import { usePagination } from '../../hooks/usePagination';
import { useSearchParam } from '../../hooks/useSearchParam';
import { formatDateTime, formatDuration, truncateId } from '../../lib/utils';
import type { Match } from '../../api/types';

const STATE_OPTIONS = ['', 'active', 'completed', 'waiting'];

const COLUMNS: Column<Match>[] = [
  { header: 'ID', accessor: (m) => <span className="font-mono text-xs text-muted">{truncateId(m.id)}</span> },
  { header: 'Mode', accessor: (m) => <span className="capitalize">{m.mode}</span> },
  { header: 'Players', accessor: (m) => m.playerUsernames.join(' vs ') },
  { header: 'State', accessor: (m) => <StatusBadge status={m.state} /> },
  { header: 'Started', accessor: (m) => formatDateTime(m.createdAt) },
  {
    header: 'Duration',
    accessor: (m) =>
      m.completedAt
        ? formatDuration(new Date(m.completedAt).getTime() - new Date(m.createdAt).getTime())
        : <span className="text-online text-xs">In progress</span>,
  },
];

export function MatchesPage() {
  const { page, limit, setPage } = usePagination(10);
  const [state, setState] = useSearchParam('state');
  const { data, isLoading } = useMatches({ page, limit, state });

  return (
    <div>
      <PageHeader
        title="Matches"
        description={`${data?.total ?? 0} total matches`}
        actions={
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-[#e6edf3] focus:border-accent focus:outline-none"
          >
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s || 'All states'}</option>
            ))}
          </select>
        }
      />

      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        isLoading={isLoading}
        rowKey={(m) => m.id}
        emptyMessage="No matches"
      />

      <Pagination page={page} total={data?.total ?? 0} limit={limit} onPageChange={setPage} />
    </div>
  );
}
