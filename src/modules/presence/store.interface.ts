import type { UserPresence } from './types';

/**
 * Storage-agnostic presence store.
 *
 * Current implementation: PostgresPresenceStore (this file)
 * Future implementation:  RedisPresenceStore    (Fase 7)
 *
 * To swap backends, only the controller constructor needs to change.
 * PresenceService depends on this interface and never on concrete classes.
 *
 * WebSocket integration (Fase 5):
 *   On connect:    store.setOnline(userId, socketId)
 *   On disconnect: store.setOffline(userId)
 */
export interface IPresenceStore {
  /** Mark user as online. socketId is set by the WebSocket layer; omit for REST calls. */
  setOnline(userId: string, socketId?: string): Promise<void>;
  setOffline(userId: string): Promise<void>;
  /** Returns null only when the user has never been seen — treat as offline. */
  getPresence(userId: string): Promise<UserPresence | null>;
  getOnlineUsers(): Promise<UserPresence[]>;
}
