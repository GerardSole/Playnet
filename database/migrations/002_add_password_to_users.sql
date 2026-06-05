-- password_hash is nullable so the Fase-1 create-user endpoint (no auth)
-- keeps working. Will be constrained to NOT NULL once all creation goes
-- through auth/register (Fase 2 cleanup).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
