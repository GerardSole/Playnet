import type { NotificationsRepository } from './repository';
import type { Notification, NotificationType } from './types';

export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {}

  async create(
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown>
  ): Promise<Notification> {
    return this.repo.create(userId, type, payload);
  }

  async list(
    userId: string,
    options: { unreadOnly: boolean; page: number; limit: number }
  ): Promise<{ notifications: Notification[]; total: number }> {
    return this.repo.list(userId, options);
  }

  async markRead(userId: string, ids: string[]): Promise<void> {
    return this.repo.markRead(userId, ids);
  }
}
