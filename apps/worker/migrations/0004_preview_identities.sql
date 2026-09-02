CREATE TABLE IF NOT EXISTS preview_identities (
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  subject TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (provider, subject)
);
