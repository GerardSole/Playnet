import { Database } from 'lucide-react';

interface EmptyStateProps { message?: string }

export function EmptyState({ message = 'No data available' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-16 text-muted">
      <Database size={32} className="opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
