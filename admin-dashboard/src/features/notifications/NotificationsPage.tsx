import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { useNotifications } from './hooks/useNotifications';
import { usePagination } from '../../hooks/usePagination';
import { useSearchParam } from '../../hooks/useSearchParam';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTime } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { Notification } from '../../api/types';

const TYPE_OPTIONS = ['', 'friend_request', 'match_result', 'leaderboard', 'system'];

const TYPE_LABELS: Record<string, string> = {
  friend_request: 'Friendship',
  match_result: 'Match',
  leaderboard: 'Ranking',
  system: 'System',
};

const COLUMNS: Column<Notification>[] = [
  { header: 'Player', accessor: (n) => <span className="font-medium">{n.username}</span> },
  {
    header: 'Tipo',
    accessor: (n) => (
      <span className="rounded-full bg-main px-2 py-0.5 text-xs text-muted border border-border">
        {TYPE_LABELS[n.type] ?? n.type}
      </span>
    ),
  },
  { header: 'Content', accessor: 'content', className: 'max-w-xs truncate text-muted' },
  {
    header: 'Read',
    accessor: (n) => (
      <span className={cn('text-xs', n.read ? 'text-muted' : 'text-accent font-medium')}>
        {n.read ? 'Yes' : 'Unread'}
      </span>
    ),
  },
  { header: 'Date', accessor: (n) => formatDateTime(n.createdAt) },
];

export function NotificationsPage() {
  const { page, limit, setPage } = usePagination(10);
  const [q, setQ] = useSearchParam('q');
  const [type, setType] = useSearchParam('type');
  const debouncedQ = useDebounce(q);

  const { data, isLoading } = useNotifications({ page, limit, q: debouncedQ, type });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${data?.total ?? 0} total notifications`}
        actions={
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-[#e6edf3] focus:border-accent focus:outline-none"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t] ?? 'All types'}</option>
              ))}
            </select>
            <SearchInput value={q} onChange={setQ} placeholder="Search notification…" />
          </div>
        }
      />

      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        isLoading={isLoading}
        rowKey={(n) => n.id}
        emptyMessage="No notifications"
      />

      <Pagination page={page} total={data?.total ?? 0} limit={limit} onPageChange={setPage} />
    </div>
  );
}
