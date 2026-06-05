export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Public profile returned by GET /friends — no credentials or internal fields
export interface FriendProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}
