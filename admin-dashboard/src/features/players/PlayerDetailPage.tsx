import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Calendar, RefreshCw } from 'lucide-react';
import { usePlayer } from './hooks/usePlayer';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatDateTime } from '../../lib/utils';
import { MOCK_FRIENDSHIPS, MOCK_MATCHES } from '../../lib/mockData';

export function PlayerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: player, isLoading, isError, refetch } = usePlayer(id);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState message="Could not load player" onRetry={refetch} />;
  if (!player) return null;

  const friends = MOCK_FRIENDSHIPS.filter(
    (f) => f.senderId === id || f.receiverId === id
  );
  const matches = MOCK_MATCHES.filter((m) => m.playerIds.includes(id));

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted hover:text-[#e6edf3] transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Player card */}
      <div className="flex items-center gap-5 rounded-lg border border-border bg-card p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-2xl font-semibold text-accent">
          {player.username[0].toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[#e6edf3]">{player.username}</h2>
          {player.displayName && <p className="text-sm text-muted">{player.displayName}</p>}
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1"><Mail size={12} />{player.email}</span>
            <span className="flex items-center gap-1"><Calendar size={12} />Registered {formatDateTime(player.createdAt)}</span>
            <span className="flex items-center gap-1"><RefreshCw size={12} />Updated {formatDateTime(player.updatedAt)}</span>
          </div>
        </div>
        <div className="ml-auto font-mono text-xs text-muted">{player.id}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Friends */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-[#e6edf3]">Friends ({friends.length})</h3>
          {friends.length === 0 ? (
            <p className="text-sm text-muted">No friends found</p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => {
                const other = f.senderId === id ? f.receiverUsername : f.senderUsername;
                return (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#e6edf3]">{other}</span>
                    <span className={`text-xs ${f.status === 'accepted' ? 'text-online' : 'text-pending'}`}>
                      {f.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Matches */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-[#e6edf3]">Matches ({matches.length})</h3>
          {matches.length === 0 ? (
            <p className="text-sm text-muted">No matches found</p>
          ) : (
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-muted">{m.id}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted capitalize">{m.mode}</span>
                    <span className={`text-xs ${m.state === 'active' ? 'text-online' : 'text-muted'}`}>
                      {m.state}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
