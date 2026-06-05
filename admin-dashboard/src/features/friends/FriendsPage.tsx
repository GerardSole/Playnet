import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useFriends } from './hooks/useFriends';
import { usePagination } from '../../hooks/usePagination';
import { useSearchParam } from '../../hooks/useSearchParam';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../lib/utils';
import type { Friendship } from '../../api/types';

const STATUS_OPTIONS = ['', 'accepted', 'pending', 'rejected', 'blocked'];

const COLUMNS: Column<Friendship>[] = [
  { header: 'Player A', accessor: 'senderUsername' },
  { header: 'Player B', accessor: 'receiverUsername' },
  { header: 'Status', accessor: (f) => <StatusBadge status={f.status} /> },
  { header: 'Date', accessor: (f) => formatDate(f.createdAt) },
];

export function FriendsPage() {
  const { page, limit, setPage } = usePagination(10);
  const [q, setQ] = useSearchParam('q');
  const [status, setStatus] = useSearchParam('status');
  const debouncedQ = useDebounce(q);

  const { data, isLoading } = useFriends({ page, limit, q: debouncedQ, status });

  return (
    <div>
      <PageHeader
        title="Friends"
        description={`${data?.total ?? 0} friend relationships`}
        actions={
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-[#e6edf3] focus:border-accent focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s || 'All statuses'}</option>
              ))}
            </select>
            <SearchInput value={q} onChange={setQ} placeholder="Search player…" />
          </div>
        }
      />

      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        isLoading={isLoading}
        rowKey={(f) => f.id}
        emptyMessage="No friendships found"
      />

      <Pagination page={page} total={data?.total ?? 0} limit={limit} onPageChange={setPage} />
    </div>
  );
}
