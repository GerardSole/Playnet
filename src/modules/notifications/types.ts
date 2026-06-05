// Extend this union as new notification sources are added
export type NotificationType = 'friend.request' | 'friend.accepted' | 'match.created';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

// Typed payloads — kept as documentation; stored as JSONB in the DB
export interface FriendRequestPayload {
  requestId: string;
  fromUserId: string;
}

export interface FriendAcceptedPayload {
  requestId: string;
  byUserId: string;
}

export interface MatchCreatedPayload {
  matchId: string;
  players: string[];
}
