import { cn } from '../../lib/utils';

type Status = 'online' | 'offline' | 'pending' | 'ok' | 'error' | 'active' | 'completed' | 'waiting' | 'accepted' | 'rejected' | 'blocked' | 'degraded';

const STYLES: Record<Status, string> = {
  online:    'bg-online/15 text-online border-online/30',
  ok:        'bg-online/15 text-online border-online/30',
  active:    'bg-online/15 text-online border-online/30',
  accepted:  'bg-online/15 text-online border-online/30',
  offline:   'bg-muted/15 text-muted border-muted/30',
  completed: 'bg-muted/15 text-muted border-muted/30',
  blocked:   'bg-muted/15 text-muted border-muted/30',
  pending:   'bg-pending/15 text-pending border-pending/30',
  waiting:   'bg-pending/15 text-pending border-pending/30',
  error:     'bg-danger/15 text-danger border-danger/30',
  rejected:  'bg-danger/15 text-danger border-danger/30',
  degraded:  'bg-pending/15 text-pending border-pending/30',
};

const LABELS: Record<Status, string> = {
  online: 'Online', ok: 'OK', active: 'Activo', accepted: 'Aceptado',
  offline: 'Offline', completed: 'Completado', blocked: 'Bloqueado',
  pending: 'Pendiente', waiting: 'Esperando',
  error: 'Error', rejected: 'Rechazado', degraded: 'Degradado',
};

interface StatusBadgeProps { status: Status; label?: string }

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STYLES[status] ?? 'bg-muted/15 text-muted border-muted/30'
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? LABELS[status] ?? status}
    </span>
  );
}
