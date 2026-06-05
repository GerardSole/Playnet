CREATE TABLE matches (
  id UUID PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'matched'
    CHECK (status IN ('pending', 'matched', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE match_players (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, user_id)
);

-- Fast lookup: "which matches is this user in?"
CREATE INDEX idx_match_players_user_id ON match_players (user_id);
