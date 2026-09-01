ALTER TABLE players ADD COLUMN device_id TEXT;
ALTER TABLE players ADD COLUMN ip_hash TEXT;
ALTER TABLE players ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN banned_until TEXT;

UPDATE players SET device_id = id WHERE device_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_device_id ON players(device_id);
CREATE INDEX IF NOT EXISTS idx_players_ip_hash ON players(ip_hash);

CREATE TABLE IF NOT EXISTS score_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  date_key TEXT NOT NULL,
  score INTEGER NOT NULL,
  events TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_score_proofs_player ON score_proofs(player_id, date_key);

ALTER TABLE submission_log ADD COLUMN ip_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_submission_log_ip ON submission_log(ip_hash);
