import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';
import { PageLoader } from './Spinner';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns, data, isLoading, emptyMessage, rowKey, onRowClick,
}: DataTableProps<T>) {
  if (isLoading) return <PageLoader />;
  if (!data.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-sidebar">
            {columns.map((col, i) => (
              <th
                key={i}
                className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted', col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'bg-card transition-colors',
                onRowClick && 'cursor-pointer hover:bg-main'
              )}
            >
              {columns.map((col, i) => (
                <td key={i} className={cn('px-4 py-3 text-[#e6edf3]', col.className)}>
                  {typeof col.accessor === 'function'
                    ? col.accessor(row)
                    : String(row[col.accessor] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
