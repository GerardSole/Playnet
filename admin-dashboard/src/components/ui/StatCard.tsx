import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  accent?: boolean;
}

export function StatCard({ label, value, icon: Icon, trend, trendUp, accent }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-lg border border-border bg-card p-5 flex flex-col gap-3',
      accent && 'border-accent/30 bg-accent/5'
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <div className={cn(
          'rounded-md p-2',
          accent ? 'bg-accent/20 text-accent' : 'bg-main text-muted'
        )}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-3xl font-semibold text-[#e6edf3]">{value}</p>
      {trend && (
        <p className={cn('text-xs', trendUp ? 'text-online' : 'text-muted')}>
          {trend}
        </p>
      )}
    </div>
  );
}
