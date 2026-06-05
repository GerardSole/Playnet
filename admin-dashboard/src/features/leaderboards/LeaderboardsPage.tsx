import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { useLeaderboards } from './hooks/useLeaderboards';
import { formatDate } from '../../lib/utils';

export function LeaderboardsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useLeaderboards();

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Leaderboards" description={`${data?.length ?? 0} leaderboards`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((lb) => (
          <button
            key={lb.id}
            onClick={() => navigate(`/leaderboards/${lb.id}`)}
            className="rounded-lg border border-border bg-card p-5 text-left hover:border-accent/40 hover:bg-main transition-colors"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-md bg-accent/10 p-2">
                <Trophy size={16} className="text-accent" />
              </div>
              <span className="text-xs text-muted">{lb.entryCount} entries</span>
            </div>
            <h3 className="font-medium text-[#e6edf3]">{lb.name}</h3>
            <p className="mt-1 text-xs text-muted">Created {formatDate(lb.createdAt)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
