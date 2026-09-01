const ACTIVE = `(p.banned = 0 OR (p.banned_until IS NOT NULL AND p.banned_until < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`

async function getPlayerStreak(
  db: D1Database,
  playerId: string,
): Promise<number> {
  const rows = await db
    .prepare(
      "SELECT date_key AS dateKey FROM scores WHERE player_id = ? AND mode = 'daily' ORDER BY date_key DESC",
    )
    .bind(playerId)
    .all<{ dateKey: string }>()
  if (!rows.results.length) return 0

  let streak = 1
  let previous = new Date(`${rows.results[0].dateKey}T00:00:00.000Z`)
  for (const row of rows.results.slice(1)) {
    const date = new Date(`${row.dateKey}T00:00:00.000Z`)
    previous.setUTCDate(previous.getUTCDate() - 1)
    if (date.getTime() !== previous.getTime()) break
    streak += 1
    previous = date
  }
  return streak
}

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

export type WeeklyLeaderboardEntry = LeaderboardEntry & {
  streak: number
}

export type FriendRow = {
  id: string
  name: string
  streak: number
}

export type FriendRequestRow = {
  id: number
  playerId: string
  name: string
  direction: 'incoming' | 'outgoing'
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
  saveDailyScoreAndProof: (
    playerId: string,
    dateKey: string,
    score: number,
    combo: number,
    eventsJson: string,
  ) => Promise<UpsertDailyScoreResult>
  getLeaderboard: (
    dateKey: string,
    limit: number,
  ) => Promise<Array<LeaderboardEntry>>
  getRank: (dateKey: string, score: number) => Promise<RankInfo>
  getDailyCount: (dateKey: string) => Promise<number>
  getDailyScore: (playerId: string, dateKey: string) => Promise<number | null>
  getWeeklyLeaderboard: (
    weekStart: string,
    weekEnd: string,
    limit: number,
    playerIds?: Array<string>,
  ) => Promise<Array<WeeklyLeaderboardEntry>>
  getWeeklyRank: (
    weekStart: string,
    weekEnd: string,
    score: number,
    playerIds?: Array<string>,
  ) => Promise<RankInfo>
  getWeeklyCount: (
    weekStart: string,
    weekEnd: string,
    playerIds?: Array<string>,
  ) => Promise<number>
  getWeeklyScore: (
    playerId: string,
    weekStart: string,
    weekEnd: string,
  ) => Promise<number | null>
  getFriendCode: (playerId: string) => Promise<string | null>
  setFriendCode: (
    playerId: string,
    code: string,
    expiresAt: string,
  ) => Promise<void>
  findPlayerByFriendCode: (code: string) => Promise<PlayerRow | null>
  createFriendRequest: (
    requesterId: string,
    targetId: string,
  ) => Promise<'created' | 'exists'>
  respondToFriendRequest: (
    requestId: number,
    playerId: string,
    status: 'accepted' | 'declined',
  ) => Promise<boolean>
  removeFriend: (playerId: string, friendId: string) => Promise<boolean>
  getFriends: (playerId: string) => Promise<Array<FriendRow>>
  getFriendRequests: (playerId: string) => Promise<Array<FriendRequestRow>>
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
                  banned, banned_until AS bannedUntil, created_at AS createdAt
           FROM players WHERE id = ?`,
        )
        .bind(id)
        .first<PlayerRow>()
    },

    async getPlayerByDevice(deviceId) {
      return db
        .prepare(
          `SELECT id, name, device_id AS device_id, ip_hash AS ip_hash,
                  banned, banned_until AS bannedUntil, created_at AS createdAt
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
      const previous = await db
        .prepare(
          "SELECT score FROM scores WHERE player_id = ? AND date_key = ? AND mode = 'daily'",
        )
        .bind(playerId, dateKey)
        .first<{ score: number }>()
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
        isNewBest: score > (previous?.score ?? -1),
        best: row?.score ?? score,
      }
    },

    async saveDailyScoreAndProof(playerId, dateKey, score, combo, eventsJson) {
      const previous = await db
        .prepare(
          "SELECT score FROM scores WHERE player_id = ? AND date_key = ? AND mode = 'daily'",
        )
        .bind(playerId, dateKey)
        .first<{ score: number }>()
      await db.batch([
        db
          .prepare(
            `INSERT INTO scores (player_id, mode, date_key, score, combo)
             VALUES (?, 'daily', ?, ?, ?)
             ON CONFLICT(player_id, date_key) WHERE mode = 'daily'
             DO UPDATE SET
               score = excluded.score,
               combo = excluded.combo
             WHERE excluded.score > scores.score`,
          )
          .bind(playerId, dateKey, score, combo),
        db
          .prepare(
            'INSERT INTO score_proofs (player_id, date_key, score, events) VALUES (?, ?, ?, ?)',
          )
          .bind(playerId, dateKey, score, eventsJson),
      ])

      const row = await db
        .prepare(
          "SELECT score FROM scores WHERE player_id = ? AND date_key = ? AND mode = 'daily'",
        )
        .bind(playerId, dateKey)
        .first<{ score: number }>()

      return {
        isNewBest: score > (previous?.score ?? -1),
        best: row?.score ?? score,
      }
    },

    async getLeaderboard(dateKey, limit) {
      const rows = await db
        .prepare(
          `SELECT p.id AS playerId, p.name AS name, s.score AS score, s.combo AS combo
           FROM scores s
           JOIN players p ON p.id = s.player_id
           WHERE s.mode = 'daily' AND s.date_key = ? AND ${ACTIVE}
           ORDER BY s.score DESC, s.created_at ASC
           LIMIT ?`,
        )
        .bind(dateKey, limit)
        .all<Omit<LeaderboardEntry, 'rank'>>()

      return rows.results.map((row, _index, entries) => ({
        ...row,
        rank: entries.findIndex((entry) => entry.score === row.score) + 1,
      }))
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

    async getWeeklyLeaderboard(weekStart, weekEnd, limit, playerIds) {
      const idsClause = playerIds?.length
        ? ` AND s.player_id IN (${playerIds.map(() => '?').join(', ')})`
        : ''
      const rows = await db
        .prepare(
          `SELECT p.id AS playerId, p.name AS name, SUM(s.score) AS score,
                  MAX(s.combo) AS combo
           FROM scores s JOIN players p ON p.id = s.player_id
           WHERE s.mode = 'daily' AND s.date_key >= ? AND s.date_key < ? AND ${ACTIVE}${idsClause}
           GROUP BY p.id, p.name
           ORDER BY score DESC, MIN(s.created_at) ASC
           LIMIT ?`,
        )
        .bind(weekStart, weekEnd, ...(playerIds ?? []), limit)
        .all<Omit<WeeklyLeaderboardEntry, 'rank' | 'streak'>>()
      return Promise.all(
        rows.results.map(async (row, _index, entries) => ({
          ...row,
          rank: entries.findIndex((entry) => entry.score === row.score) + 1,
          streak: await getPlayerStreak(db, row.playerId),
        })),
      )
    },

    async getWeeklyRank(weekStart, weekEnd, score, playerIds) {
      const idsClause = playerIds?.length
        ? ` AND s.player_id IN (${playerIds.map(() => '?').join(', ')})`
        : ''
      const count = await db
        .prepare(
          `WITH weekly AS (
             SELECT s.player_id, SUM(s.score) AS score
             FROM scores s JOIN players p ON p.id = s.player_id
             WHERE s.mode = 'daily' AND s.date_key >= ? AND s.date_key < ? AND ${ACTIVE}${idsClause}
             GROUP BY s.player_id
           )
           SELECT COUNT(*) AS total, SUM(CASE WHEN score > ? THEN 1 ELSE 0 END) AS above FROM weekly`,
        )
        .bind(weekStart, weekEnd, ...(playerIds ?? []), score)
        .first<{ total: number; above: number | null }>()
      const total = count?.total ?? 0
      const rank = (count?.above ?? 0) + 1
      return {
        total,
        rank,
        topPercent:
          total > 0
            ? Math.min(100, Math.max(1, Math.round((rank / total) * 100)))
            : 100,
      }
    },

    async getWeeklyCount(weekStart, weekEnd, playerIds) {
      const idsClause = playerIds?.length
        ? ` AND s.player_id IN (${playerIds.map(() => '?').join(', ')})`
        : ''
      const row = await db
        .prepare(
          `SELECT COUNT(DISTINCT s.player_id) AS count FROM scores s
           JOIN players p ON p.id = s.player_id
           WHERE s.mode = 'daily' AND s.date_key >= ? AND s.date_key < ? AND ${ACTIVE}${idsClause}`,
        )
        .bind(weekStart, weekEnd, ...(playerIds ?? []))
        .first<{ count: number }>()
      return row?.count ?? 0
    },

    async getWeeklyScore(playerId, weekStart, weekEnd) {
      const row = await db
        .prepare(
          `SELECT SUM(s.score) AS score FROM scores s JOIN players p ON p.id = s.player_id
           WHERE s.player_id = ? AND s.mode = 'daily' AND s.date_key >= ? AND s.date_key < ? AND ${ACTIVE}`,
        )
        .bind(playerId, weekStart, weekEnd)
        .first<{ score: number | null }>()
      return row?.score ?? null
    },

    async getFriendCode(playerId) {
      const row = await db
        .prepare(
          "SELECT code FROM friend_codes WHERE player_id = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        )
        .bind(playerId)
        .first<{ code: string }>()
      return row?.code ?? null
    },

    async setFriendCode(playerId, code, expiresAt) {
      await db
        .prepare(
          `INSERT INTO friend_codes (player_id, code, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(player_id) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at,
             created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(playerId, code, expiresAt)
        .run()
    },

    async findPlayerByFriendCode(code) {
      return db
        .prepare(
          `SELECT p.id, p.name, p.device_id AS deviceId, p.ip_hash AS ipHash, p.banned,
                  p.banned_until AS bannedUntil, p.created_at AS createdAt
           FROM friend_codes c JOIN players p ON p.id = c.player_id
           WHERE c.code = ? AND c.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(code)
        .first<PlayerRow>()
    },

    async createFriendRequest(requesterId, targetId) {
      const [low, high] = [requesterId, targetId].sort()
      const result = await db
        .prepare(
          `INSERT INTO friend_requests (player_low_id, player_high_id, requested_by_id, status)
           VALUES (?, ?, ?, 'pending') ON CONFLICT(player_low_id, player_high_id) DO NOTHING`,
        )
        .bind(low, high, requesterId)
        .run()
      return result.meta.changes ? 'created' : 'exists'
    },

    async respondToFriendRequest(requestId, playerId, status) {
      const result = await db
        .prepare(
          `UPDATE friend_requests SET status = ?, responded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ? AND status = 'pending' AND requested_by_id != ?
             AND (player_low_id = ? OR player_high_id = ?)`,
        )
        .bind(status, requestId, playerId, playerId, playerId)
        .run()
      return result.meta.changes > 0
    },

    async removeFriend(playerId, friendId) {
      const [low, high] = [playerId, friendId].sort()
      const result = await db
        .prepare(
          "DELETE FROM friend_requests WHERE player_low_id = ? AND player_high_id = ? AND status = 'accepted'",
        )
        .bind(low, high)
        .run()
      return result.meta.changes > 0
    },

    async getFriends(playerId) {
      const rows = await db
        .prepare(
          `SELECT p.id, p.name FROM friend_requests f JOIN players p ON p.id =
             CASE WHEN f.player_low_id = ? THEN f.player_high_id ELSE f.player_low_id END
           WHERE f.status = 'accepted' AND (f.player_low_id = ? OR f.player_high_id = ?) AND ${ACTIVE}`,
        )
        .bind(playerId, playerId, playerId)
        .all<{ id: string; name: string }>()
      return Promise.all(
        rows.results.map(async (friend) => ({
          ...friend,
          streak: await getPlayerStreak(db, friend.id),
        })),
      )
    },

    async getFriendRequests(playerId) {
      const rows = await db
        .prepare(
          `SELECT f.id, p.id AS playerId, p.name AS name,
                  CASE WHEN f.requested_by_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
           FROM friend_requests f JOIN players p ON p.id =
             CASE WHEN f.player_low_id = ? THEN f.player_high_id ELSE f.player_low_id END
           WHERE f.status = 'pending' AND (f.player_low_id = ? OR f.player_high_id = ?) AND ${ACTIVE}`,
        )
        .bind(playerId, playerId, playerId, playerId)
        .all<FriendRequestRow>()
      return rows.results
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
        const scoresResult = await db
          .prepare('DELETE FROM scores WHERE player_id = ? AND date_key = ?')
          .bind(playerId, dateKey)
          .run()
        await db
          .prepare(
            'DELETE FROM score_proofs WHERE player_id = ? AND date_key = ?',
          )
          .bind(playerId, dateKey)
          .run()
        return scoresResult.meta.changes
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
