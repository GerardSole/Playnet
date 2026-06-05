export interface CreateLeaderboardDto {
  name: string;
}

// leaderboardId is intentionally absent — it comes from the URL param, not the body
export interface SubmitScoreDto {
  score: number;
}
