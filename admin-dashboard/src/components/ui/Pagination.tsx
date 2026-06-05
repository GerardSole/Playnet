import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-muted">
      <span>
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
      </span>
      <div className="flex gap-1">
        <button
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            'rounded-md border border-border p-1.5 transition-colors',
            page === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-card text-[#e6edf3]'
          )}
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | '...')[]>((acc, p, i, arr) => {
            if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="px-2 py-1">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={cn(
                  'min-w-[32px] rounded-md border px-2 py-1 text-xs transition-colors',
                  p === page
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border hover:bg-card text-[#e6edf3]'
                )}
              >
                {p}
              </button>
            )
          )}
        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            'rounded-md border border-border p-1.5 transition-colors',
            page === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-card text-[#e6edf3]'
          )}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
