export interface Leaderboard {
  id: string;
  name: string;
  createdAt: Date;
}

export interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
  updatedAt: Date;
}
