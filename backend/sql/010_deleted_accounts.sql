-- Migration 010: Track deleted accounts for retention stats
-- Stores only what's needed to report on churn: name, how long the account
-- was held, and when it was deleted. No email/password/workout data retained.
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  account_created_at TIMESTAMP   NOT NULL,
  deleted_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_deleted_at ON deleted_accounts(deleted_at DESC);
