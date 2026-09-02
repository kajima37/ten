CREATE TABLE IF NOT EXISTS oauth_transactions (
  id TEXT NOT NULL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  state TEXT NOT NULL,
  verifier TEXT NOT NULL,
  nonce TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_transactions_expires_at
  ON oauth_transactions (expires_at);

CREATE TABLE IF NOT EXISTS oauth_sessions (
  id TEXT NOT NULL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  subject TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_identity
  ON oauth_sessions (provider, subject);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at
  ON oauth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_identities (
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  subject TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  approved_at TEXT,
  approved_by TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (provider, subject)
);

CREATE TABLE IF NOT EXISTS banned_ip_hashes (
  ip_hash TEXT PRIMARY KEY,
  reason TEXT,
  banned_by TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_provider TEXT NOT NULL,
  actor_subject TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT,
  before_json TEXT,
  after_json TEXT,
  affected_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON admin_audit_logs (created_at);

ALTER TABLE scores ADD COLUMN hidden_at TEXT;
