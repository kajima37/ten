CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Player',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  mode TEXT NOT NULL CHECK (mode IN ('daily', 'normal')),
  date_key TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  combo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_rank
  ON scores(mode, date_key, score DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_daily_player
  ON scores(player_id, date_key)
  WHERE mode = 'daily';

CREATE TABLE IF NOT EXISTS submission_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_submission_log_player_time
  ON submission_log(player_id, created_at);
