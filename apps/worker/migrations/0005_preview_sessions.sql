CREATE TABLE IF NOT EXISTS preview_transactions (
  id TEXT NOT NULL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  state TEXT NOT NULL,
  verifier TEXT NOT NULL,
  nonce TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_preview_transactions_expires_at
  ON preview_transactions (expires_at);

CREATE TABLE IF NOT EXISTS preview_sessions (
  id TEXT NOT NULL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  subject TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_preview_sessions_identity
  ON preview_sessions (provider, subject);

CREATE INDEX IF NOT EXISTS idx_preview_sessions_expires_at
  ON preview_sessions (expires_at);

ALTER TABLE preview_identities ADD COLUMN approved_at TEXT;
ALTER TABLE preview_identities ADD COLUMN approved_by TEXT;
ALTER TABLE preview_identities ADD COLUMN last_seen_at TEXT;

UPDATE preview_identities
SET approved_at = created_at
WHERE revoked_at IS NULL AND approved_at IS NULL;
