import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps { message?: string; onRetry?: () => void }

export function ErrorState({ message = 'Failed to load data', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-danger/20 bg-danger/5 py-16">
      <AlertTriangle size={32} className="text-danger" />
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-md bg-card px-4 py-2 text-sm text-[#e6edf3] border border-border hover:bg-main transition-colors"
        >
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
