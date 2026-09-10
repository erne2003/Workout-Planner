-- Migration 009: Admin infrastructure
-- token_version for true force-logout (invalidates all outstanding JWTs instantly)
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0;

-- Account control
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- General-purpose admin info table (error logs, audit events, future kinds)
CREATE TABLE IF NOT EXISTS admin_info (
  id          SERIAL PRIMARY KEY,
  kind        VARCHAR(20)  NOT NULL DEFAULT 'log',    -- 'log' | 'audit' | ...
  level       VARCHAR(10)  NOT NULL DEFAULT 'error',  -- 'error' | 'warn' | 'info'
  message     TEXT         NOT NULL,
  context     JSONB,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_is_disabled        ON users(is_disabled);
CREATE INDEX IF NOT EXISTS idx_admin_info_created_at    ON admin_info(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_info_level         ON admin_info(level);
CREATE INDEX IF NOT EXISTS idx_admin_info_kind          ON admin_info(kind);
