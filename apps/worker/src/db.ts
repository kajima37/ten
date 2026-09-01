const ACTIVE = `p.banned = 0 OR (p.banned_until IS NOT NULL AND p.banned_until < strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

export type PlayerRow = {
  id: string
  name: string
  deviceId: string | null
  ipHash: string | null
  banned: number
  bannedUntil: string | null
  createdAt: string
}

export type PlayerAdminRow = {
  id: string
  name: string
  ipHash: string | null
  banned: number
  createdAt: string
  scores: Array<{
    dateKey: string
    score: number
    combo: number
    createdAt: string
  }>
}

export type LeaderboardEntry = {
  rank: number
  playerId: string
  name: string
  score: number
  combo: number
}

export type RankInfo = {
  total: number
  rank: number
  topPercent: number
}

export type UpsertDailyScoreResult = {
  isNewBest: boolean
  best: number
}

export interface Store {
  getPlayer: (id: string) => Promise<PlayerRow | null>
  getPlayerByDevice: (deviceId: string) => Promise<PlayerRow | null>
  createPlayer: (
    playerId: string,
    deviceId: string,
    name: string,
    ipHash: string,
  ) => Promise<void>
  updatePlayerName: (id: string, name: string) => Promise<void>
  countRecentRegistrations: (
    ipHash: string,
    sinceIso: string,
  ) => Promise<number>
  upsertDailyScore: (
    playerId: string,
    dateKey: string,
    score: number,
    combo: number,
  ) => Promise<UpsertDailyScoreResult>
  getLeaderboard: (
    dateKey: string,
    limit: number,
  ) => Promise<Array<LeaderboardEntry>>
  getRank: (dateKey: string, score: number) => Promise<RankInfo>
  getDailyCount: (dateKey: string) => Promise<number>
  getDailyScore: (playerId: string, dateKey: string) => Promise<number | null>
  countRecentSubmissions: (
    playerId: string,
    sinceIso: string,
  ) => Promise<number>
  countRecentSubmissionsByIp: (
    ipHash: string,
    sinceIso: string,
  ) => Promise<number>
  logSubmission: (playerId: string, ipHash: string) => Promise<void>
  saveScoreProof: (
    playerId: string,
    dateKey: string,
    score: number,
    eventsJson: string,
  ) => Promise<void>
  banPlayer: (playerId: string, untilIso: string | null) => Promise<void>
  unbanPlayer: (playerId: string) => Promise<void>
  banPlayersByIp: (ipHash: string, untilIso: string | null) => Promise<number>
  findPlayersByIp: (ipHash: string) => Promise<Array<PlayerAdminRow>>
  deletePlayerScores: (playerId: string, dateKey?: string) => Promise<number>
}

export function createD1Store(db: D1Database): Store {
  return {
    async getPlayer(id) {
      return db
        .prepare(
          `SELECT id, name, device_id AS device_id, ip_hash AS ip_hash,
                  banned, banned_until AS banned_until, created_at AS created_at
           FROM players WHERE id = ?`,
        )
        .bind(id)
        .first<PlayerRow>()
    },

    async getPlayerByDevice(deviceId) {
      return db
        .prepare(
          `SELECT id, name, device_id AS device_id, ip_hash AS ip_hash,
                  banned, banned_until AS banned_until, created_at AS created_at
           FROM players WHERE device_id = ?`,
        )
        .bind(deviceId)
        .first<PlayerRow>()
    },

    async createPlayer(playerId, deviceId, name, ipHash) {
      await db
        .prepare(
          `INSERT INTO players (id, device_id, name, ip_hash)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(device_id) DO NOTHING`,
        )
        .bind(playerId, deviceId, name, ipHash)
        .run()
    },

    async updatePlayerName(id, name) {
      await db
        .prepare('UPDATE players SET name = ? WHERE id = ?')
        .bind(name, id)
        .run()
    },

    async countRecentRegistrations(ipHash, sinceIso) {
      const row = await db
        .prepare(
          'SELECT COUNT(*) AS count FROM players WHERE ip_hash = ? AND created_at >= ?',
        )
        .bind(ipHash, sinceIso)
        .first<{ count: number }>()
      return row?.count ?? 0
    },

    async upsertDailyScore(playerId, dateKey, score, combo) {
      await db
        .prepare(
          `INSERT INTO scores (player_id, mode, date_key, score, combo)
           VALUES (?, 'daily', ?, ?, ?)
           ON CONFLICT(player_id, date_key) WHERE mode = 'daily'
           DO UPDATE SET
             score = excluded.score,
             combo = excluded.combo
           WHERE excluded.score > scores.score`,
        )
        .bind(playerId, dateKey, score, combo)
        .run()

      const row = await db
        .prepare(
          "SELECT score, combo FROM scores WHERE player_id = ? AND date_key = ? AND mode = 'daily'",
        )
        .bind(playerId, dateKey)
        .first<{ score: number; combo: number }>()

      return {
        isNewBest: score >= (row?.score ?? 0),
        best: row?.score ?? score,
      }
    },

    async getLeaderboard(dateKey, limit) {
      const rows = await db
        .prepare(
          `SELECT p.id AS player_id, p.name AS name, s.score AS score, s.combo AS combo
           FROM scores s
           JOIN players p ON p.id = s.player_id
           WHERE s.mode = 'daily' AND s.date_key = ? AND ${ACTIVE}
           ORDER BY s.score DESC, s.created_at ASC
           LIMIT ?`,
        )
        .bind(dateKey, limit)
        .all<Omit<LeaderboardEntry, 'rank'>>()

      return rows.results.map((row, index) => ({ ...row, rank: index + 1 }))
    },

    async getRank(dateKey, score) {
      const count = await db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM scores s JOIN players p ON p.id = s.player_id
               WHERE s.mode = 'daily' AND s.date_key = ? AND ${ACTIVE}) AS total,
             (SELECT COUNT(*) FROM scores s JOIN players p ON p.id = s.player_id
               WHERE s.mode = 'daily' AND s.date_key = ? AND ${ACTIVE} AND s.score > ?) AS above`,
        )
        .bind(dateKey, dateKey, score)
        .first<{ total: number; above: number }>()

      const total = count?.total ?? 0
      const above = count?.above ?? 0
      const rank = above + 1
      const topPercent =
        total > 0
          ? Math.min(100, Math.max(1, Math.round((rank / total) * 100)))
          : 100

      return { total, rank, topPercent }
    },

    async getDailyCount(dateKey) {
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS count FROM scores s JOIN players p ON p.id = s.player_id
           WHERE s.mode = 'daily' AND s.date_key = ? AND ${ACTIVE}`,
        )
        .bind(dateKey)
        .first<{ count: number }>()
      return row?.count ?? 0
    },

    async getDailyScore(playerId, dateKey) {
      const row = await db
        .prepare(
          `SELECT s.score AS score FROM scores s JOIN players p ON p.id = s.player_id
           WHERE s.player_id = ? AND s.date_key = ? AND s.mode = 'daily' AND ${ACTIVE}`,
        )
        .bind(playerId, dateKey)
        .first<{ score: number }>()
      return row?.score ?? null
    },

    async countRecentSubmissions(playerId, sinceIso) {
      const row = await db
        .prepare(
          'SELECT COUNT(*) AS count FROM submission_log WHERE player_id = ? AND created_at >= ?',
        )
        .bind(playerId, sinceIso)
        .first<{ count: number }>()
      return row?.count ?? 0
    },

    async countRecentSubmissionsByIp(ipHash, sinceIso) {
      const row = await db
        .prepare(
          'SELECT COUNT(*) AS count FROM submission_log WHERE ip_hash = ? AND created_at >= ?',
        )
        .bind(ipHash, sinceIso)
        .first<{ count: number }>()
      return row?.count ?? 0
    },

    async logSubmission(playerId, ipHash) {
      await db
        .prepare(
          'INSERT INTO submission_log (player_id, ip_hash) VALUES (?, ?)',
        )
        .bind(playerId, ipHash)
        .run()
    },

    async saveScoreProof(playerId, dateKey, score, eventsJson) {
      await db
        .prepare(
          'INSERT INTO score_proofs (player_id, date_key, score, events) VALUES (?, ?, ?, ?)',
        )
        .bind(playerId, dateKey, score, eventsJson)
        .run()
    },

    async banPlayer(playerId, untilIso) {
      await db
        .prepare('UPDATE players SET banned = 1, banned_until = ? WHERE id = ?')
        .bind(untilIso, playerId)
        .run()
    },

    async unbanPlayer(playerId) {
      await db
        .prepare(
          'UPDATE players SET banned = 0, banned_until = NULL WHERE id = ?',
        )
        .bind(playerId)
        .run()
    },

    async banPlayersByIp(ipHash, untilIso) {
      const result = await db
        .prepare(
          'UPDATE players SET banned = 1, banned_until = ? WHERE ip_hash = ?',
        )
        .bind(untilIso, ipHash)
        .run()
      return result.meta.changes
    },

    async findPlayersByIp(ipHash) {
      const players = await db
        .prepare(
          `SELECT id, name, ip_hash AS ip_hash, banned, created_at AS created_at
           FROM players WHERE ip_hash = ?`,
        )
        .bind(ipHash)
        .all<{
          id: string
          name: string
          ip_hash: string | null
          banned: number
          created_at: string
        }>()

      const rows: Array<PlayerAdminRow> = []
      for (const player of players.results) {
        const scores = await db
          .prepare(
            "SELECT date_key AS date_key, score, combo, created_at AS created_at FROM scores WHERE player_id = ? AND mode = 'daily' ORDER BY created_at DESC",
          )
          .bind(player.id)
          .all<{
            date_key: string
            score: number
            combo: number
            created_at: string
          }>()
        rows.push({
          id: player.id,
          name: player.name,
          ipHash: player.ip_hash,
          banned: player.banned,
          createdAt: player.created_at,
          scores: scores.results.map((score) => ({
            dateKey: score.date_key,
            score: score.score,
            combo: score.combo,
            createdAt: score.created_at,
          })),
        })
      }
      return rows
    },

    async deletePlayerScores(playerId, dateKey) {
      if (dateKey) {
        await db
          .prepare('DELETE FROM scores WHERE player_id = ? AND date_key = ?')
          .bind(playerId, dateKey)
          .run()
        await db
          .prepare(
            'DELETE FROM score_proofs WHERE player_id = ? AND date_key = ?',
          )
          .bind(playerId, dateKey)
          .run()
        return 1
      }

      const scoresResult = await db
        .prepare('DELETE FROM scores WHERE player_id = ?')
        .bind(playerId)
        .run()
      await db
        .prepare('DELETE FROM score_proofs WHERE player_id = ?')
        .bind(playerId)
        .run()
      return scoresResult.meta.changes
    },
  }
}
