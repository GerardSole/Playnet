import type { IPresenceStore } from './store.interface';
import type { UserPresence } from './types';

export class PresenceService {
  constructor(private readonly store: IPresenceStore) {}

  async setOnline(userId: string, socketId?: string): Promise<UserPresence> {
    await this.store.setOnline(userId, socketId);
    return this.getPresence(userId);
  }

  async setOffline(userId: string): Promise<UserPresence> {
    await this.store.setOffline(userId);
    return this.getPresence(userId);
  }

  async getPresence(userId: string): Promise<UserPresence> {
    const presence = await this.store.getPresence(userId);
    // User has never connected — treat as offline with current timestamp
    return (
      presence ?? {
        userId,
        status: 'offline' as const,
        lastSeen: new Date(),
        socketId: undefined,
      }
    );
  }

  async getOnlineUsers(): Promise<UserPresence[]> {
    return this.store.getOnlineUsers();
  }
}
