export type PresenceStatus = 'online' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  socketId?: string;
}
