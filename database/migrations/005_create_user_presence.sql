CREATE TABLE IF NOT EXISTS user_presence (
  user_id    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status     VARCHAR(10) NOT NULL DEFAULT 'offline'
             CHECK (status IN ('online', 'offline')),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- socket_id is populated by the WebSocket layer (Fase 5).
  -- NULL when status was set via the REST API or user disconnected.
  socket_id  TEXT
);

-- Partial index — only online users need fast lookups in practice
CREATE INDEX IF NOT EXISTS idx_user_presence_online
  ON user_presence (user_id)
  WHERE status = 'online';
