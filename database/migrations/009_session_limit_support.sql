-- Session limit support: track last activity per token and add efficient
-- per-user ordering index for LRU eviction.
--
-- last_used_at is updated on every /refresh call (via UPDATE-based rotation).
-- It starts equal to created_at (the moment the session was established) and
-- advances with each use.  The eviction policy sorts by last_used_at ASC so
-- the least-recently-used session is always the first to go.
--
-- DEFAULT NOW() makes this migration safe to apply to existing rows: all
-- current tokens get last_used_at = their creation time, which is a reasonable
-- approximation of "last use" for data that predates this column.

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Back-fill: align last_used_at with created_at for existing rows.
UPDATE refresh_tokens SET last_used_at = created_at WHERE last_used_at > created_at;

-- Composite index: user_id narrows the scan to one user, last_used_at ASC
-- orders sessions oldest-first for O(log n) eviction queries.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_last_used
  ON refresh_tokens (user_id, last_used_at ASC);
