// ── Shared domain types ───────────────────────────────────────────────────────

export interface Player {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Friendship {
  id: string;
  senderId: string;
  receiverId: string;
  senderUsername: string;
  receiverUsername: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: string;
}

export interface Match {
  id: string;
  mode: string;
  state: 'waiting' | 'active' | 'completed';
  playerIds: string[];
  playerUsernames: string[];
  createdAt: string;
  completedAt?: string;
}

export interface Leaderboard {
  id: string;
  name: string;
  entryCount: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  submittedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  username: string;
  type: 'friend_request' | 'match_result' | 'leaderboard' | 'system';
  content: string;
  read: boolean;
  createdAt: string;
}

export interface PresenceEntry {
  userId: string;
  username: string;
  socketId: string;
  onlineSince: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  version: string;
  services: {
    postgres: 'ok' | 'error';
    redis: 'ok' | 'error';
    socketAdapter: 'ok' | 'error';
  };
}

// ── API wrapper types ─────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiError {
  error: {
    statusCode: number;
    code: string;
    message: string;
  };
  requestId: string;
}
