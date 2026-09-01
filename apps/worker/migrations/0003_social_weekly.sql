CREATE INDEX IF NOT EXISTS idx_scores_daily_weekly
  ON scores(mode, date_key, player_id);

CREATE TABLE IF NOT EXISTS friend_codes (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_low_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_high_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  requested_by_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  responded_at TEXT,
  UNIQUE(player_low_id, player_high_id),
  CHECK (player_low_id < player_high_id),
  CHECK (requested_by_id IN (player_low_id, player_high_id))
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_low ON friend_requests(player_low_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_high ON friend_requests(player_high_id, status);
