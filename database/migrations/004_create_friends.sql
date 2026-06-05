CREATE TABLE IF NOT EXISTS friend_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(10) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- DB-level defence: service validates too, but the constraint is the true guard
  CONSTRAINT friend_requests_no_self CHECK (sender_id <> receiver_id),
  -- One active pair per direction (A→B and B→A are distinct rows)
  UNIQUE (sender_id, receiver_id)
);

-- Bidirectional friendship: both (A,B) and (B,A) rows are stored.
-- Allows O(1) lookup: SELECT WHERE user_id = $1 (no OR needed).
CREATE TABLE IF NOT EXISTS friendships (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests (receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender   ON friend_requests (sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id      ON friendships (user_id);
