/**
 * Typed event maps for Socket.IO.
 *
 * Add events here as new phases are implemented:
 *   Fase 5  — presence (connection / disconnect handled internally, not emitted as events yet)
 *   Fase 6  — match:created, match:cancelled
 *   Fase 7+ — leaderboard:updated, friend:online, friend:offline
 */

// Server → Client
export interface ServerToClientEvents {
  'match:created': (payload: { matchId: string; players: string[] }) => void;
  'notification:new': (notification: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    read: boolean;
    createdAt: string;
  }) => void;
}

// Client → Server
export interface ClientToServerEvents {}

// Data stored on each socket instance — accessible via socket.data
export interface SocketData {
  userId: string;
}

// Convenience type alias used in gateway.plugin.ts and anywhere else that needs the io instance
export type { Server } from 'socket.io';
