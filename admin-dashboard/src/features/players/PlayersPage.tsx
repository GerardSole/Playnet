import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { ErrorState } from '../../components/ui/ErrorState';
import { usePlayers } from './hooks/usePlayers';
import { usePagination } from '../../hooks/usePagination';
import { useSearchParam } from '../../hooks/useSearchParam';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTime, truncateId } from '../../lib/utils';
import type { Player } from '../../api/types';

const COLUMNS: Column<Player>[] = [
  { header: 'ID', accessor: (p) => <span className="font-mono text-xs text-muted">{truncateId(p.id)}</span> },
  { header: 'Username', accessor: (p) => <span className="font-medium">{p.username}</span> },
  { header: 'Email', accessor: 'email', className: 'text-muted' },
  { header: 'Registered', accessor: (p) => formatDateTime(p.createdAt) },
  { header: 'Last updated', accessor: (p) => formatDateTime(p.updatedAt) },
];

export function PlayersPage() {
  const navigate = useNavigate();
  const { page, limit, setPage } = usePagination(10);
  const [q, setQ] = useSearchParam('q');
  const debouncedQ = useDebounce(q);

  const { data, isLoading, isError, refetch } = usePlayers({ page, limit, q: debouncedQ });

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Players"
        description={`${data?.total ?? 0} registered players`}
        actions={<SearchInput value={q} onChange={setQ} placeholder="Search by username or email…" />}
      />

      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        isLoading={isLoading}
        rowKey={(p) => p.id}
        onRowClick={(p) => navigate(`/players/${p.id}`)}
        emptyMessage="No players found"
      />

      <Pagination
        page={page}
        total={data?.total ?? 0}
        limit={limit}
        onPageChange={setPage}
      />
    </div>
  );
}
