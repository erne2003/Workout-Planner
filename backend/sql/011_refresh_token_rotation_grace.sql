-- Rotation grace: a refresh token rotated less than 60 seconds ago is still
-- accepted once, so a client that lost the rotation response can retry.
-- rotated_at is set only by rotation, never by logout or admin revocation.
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);
