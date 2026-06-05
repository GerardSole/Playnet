CREATE TABLE leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One score row per (leaderboard, player). Upsert keeps only the best score.
CREATE TABLE leaderboard_scores (
  leaderboard_id UUID NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  score          BIGINT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (leaderboard_id, user_id)
);

-- Covering index: satisfies ORDER BY score DESC queries without a separate sort
CREATE INDEX idx_leaderboard_scores_ranking ON leaderboard_scores (leaderboard_id, score DESC);
