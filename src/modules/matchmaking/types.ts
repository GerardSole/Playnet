export type MatchStatus = 'pending' | 'matched' | 'cancelled';

export interface QueueEntry {
  userId: string;
  queuedAt: Date;
  metadata: Record<string, unknown>;
}

export interface Match {
  id: string;
  players: string[];
  status: MatchStatus;
  createdAt: Date;
}
