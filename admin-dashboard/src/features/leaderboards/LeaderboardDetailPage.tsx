import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Medal } from 'lucide-react';
import { useLeaderboardRankings } from './hooks/useLeaderboardRankings';
import { useLeaderboards } from './hooks/useLeaderboards';
import { PageLoader } from '../../components/ui/Spinner';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { formatDateTime } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { LeaderboardEntry } from '../../api/types';

const RANK_COLORS: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-orange-400',
};

const COLUMNS: Column<LeaderboardEntry>[] = [
  {
    header: '#',
    accessor: (e) => (
      <span className={cn('font-semibold', RANK_COLORS[e.rank] ?? 'text-muted')}>
        {e.rank <= 3 ? <Medal size={14} className="inline mr-1" /> : null}{e.rank}
      </span>
    ),
  },
  { header: 'Player', accessor: (e) => <span className="font-medium">{e.username}</span> },
  { header: 'Score', accessor: (e) => <span className="font-mono font-semibold text-accent">{e.score.toLocaleString()}</span> },
  { header: 'Submitted', accessor: (e) => formatDateTime(e.submittedAt) },
];

export function LeaderboardDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { page, limit, setPage } = usePagination(20);
  const { data: leaderboards } = useLeaderboards();
  const { data: entries, isLoading } = useLeaderboardRankings(id, { page, limit });

  const lb = leaderboards?.find((l) => l.id === id);
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted hover:text-[#e6edf3] transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-[#e6edf3]">{lb?.name ?? 'Leaderboard'}</h2>
        <p className="text-sm text-muted">{entries?.length ?? 0} participants</p>
      </div>

      <DataTable
        columns={COLUMNS}
        data={entries ?? []}
        rowKey={(e) => e.userId}
        emptyMessage="No entries in this leaderboard"
      />

      <Pagination page={page} total={entries?.length ?? 0} limit={limit} onPageChange={setPage} />
    </div>
  );
}
