export type AdminPlayerSummary = {
  id: string
  name: string
  ipHash: string | null
  banned: number
  bannedUntil: string | null
  createdAt: string
  scoreCount: number
  hiddenCount: number
}

export type AdminScoreRow = {
  dateKey: string
  score: number
  combo: number
  createdAt: string
  hiddenAt: string | null
}

export type AdminPlayerDetail = {
  id: string
  name: string
  ipHash: string | null
  banned: number
  bannedUntil: string | null
  createdAt: string
  scores: Array<AdminScoreRow>
}

export type AdminIpBanRow = {
  ipHash: string
  reason: string | null
  bannedBy: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminAuditRow = {
  id: number
  actorProvider: string
  actorSubject: string
  action: string
  targetType: string
  targetId: string
  reason: string | null
  beforeJson: string | null
  afterJson: string | null
  affectedCount: number | null
  createdAt: string
}

export type AdminIdentityRow = {
  provider: string
  subject: string
  email: string | null
  displayName: string | null
  approvedAt: string | null
  approvedBy: string | null
  revokedAt: string | null
  createdAt: string
  lastSeenAt: string | null
}

export type AdminSearchQuery = {
  playerId?: string
  name?: string
  ipHash?: string
  limit: number
}

export type AdminAuditEntry = {
  actorProvider: string
  actorSubject: string
  action: string
  targetType: string
  targetId: string
  reason: string | null
  beforeJson: string | null
  afterJson: string | null
  affectedCount: number | null
}

export type AdminIpBanOptions = {
  reason: string
  bannedBy: string
  untilIso: string | null
}

export interface AdminStore {
  searchPlayers: (query: AdminSearchQuery) => Promise<Array<AdminPlayerSummary>>
  getPlayerDetail: (id: string) => Promise<AdminPlayerDetail | null>
  banPlayer: (id: string, untilIso: string | null) => Promise<boolean>
  unbanPlayer: (id: string) => Promise<boolean>
  banIpHash: (ipHash: string, options: AdminIpBanOptions) => Promise<number>
  unbanIpHash: (ipHash: string) => Promise<boolean>
  isIpBanned: (ipHash: string) => Promise<AdminIpBanRow | null>
  listBannedIps: () => Promise<Array<AdminIpBanRow>>
  countPlayersByIp: (ipHash: string) => Promise<number>
  hidePlayerScores: (id: string, dateKey: string | null) => Promise<number>
  unhidePlayerScores: (id: string, dateKey: string | null) => Promise<number>
  recordAudit: (entry: AdminAuditEntry) => Promise<void>
  listAuditLogs: (
    limit: number,
    offset: number,
  ) => Promise<Array<AdminAuditRow>>
  listIdentities: () => Promise<Array<AdminIdentityRow>>
  getIdentity: (
    provider: string,
    subject: string,
  ) => Promise<AdminIdentityRow | null>
  approveIdentity: (
    provider: string,
    subject: string,
    approvedBy: string,
  ) => Promise<boolean>
  revokeIdentity: (provider: string, subject: string) => Promise<boolean>
  countAllowedIdentities: () => Promise<number>
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"

export function createD1AdminStore(
  db: D1Database,
  environment: 'staging' | 'production',
): AdminStore {
  const identityTable =
    environment === 'production' ? 'admin_identities' : 'preview_identities'
  return {
    async searchPlayers(query) {
      const conditions: Array<string> = []
      const params: Array<string | number> = []
      if (query.playerId) {
        conditions.push('p.id = ?')
        params.push(query.playerId)
      }
      if (query.name) {
        conditions.push("p.name LIKE ? ESCAPE '\\'")
        params.push(`%${query.name.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`)
      }
      if (query.ipHash) {
        conditions.push('p.ip_hash = ?')
        params.push(query.ipHash)
      }
      params.push(query.limit)
      const rows = await db
        .prepare(
          `SELECT p.id, p.name, p.ip_hash AS ipHash, p.banned,
                  p.banned_until AS bannedUntil, p.created_at AS createdAt,
                  (SELECT COUNT(*) FROM scores s WHERE s.player_id = p.id AND s.mode = 'daily') AS scoreCount,
                  (SELECT COUNT(*) FROM scores s WHERE s.player_id = p.id AND s.mode = 'daily' AND s.hidden_at IS NOT NULL) AS hiddenCount
           FROM players p
           WHERE ${conditions.join(' AND ')}
           ORDER BY p.created_at DESC
           LIMIT ?`,
        )
        .bind(...params)
        .all<AdminPlayerSummary>()
      return rows.results
    },

    async getPlayerDetail(id) {
      const player = await db
        .prepare(
          `SELECT p.id, p.name, p.ip_hash AS ipHash, p.banned,
                  p.banned_until AS bannedUntil, p.created_at AS createdAt
           FROM players p WHERE p.id = ?`,
        )
        .bind(id)
        .first<Omit<AdminPlayerDetail, 'scores'>>()
      if (!player) return null
      const scores = await db
        .prepare(
          `SELECT date_key AS dateKey, score, combo,
                  created_at AS createdAt, hidden_at AS hiddenAt
           FROM scores WHERE player_id = ? AND mode = 'daily'
           ORDER BY created_at DESC`,
        )
        .bind(id)
        .all<AdminScoreRow>()
      return { ...player, scores: scores.results }
    },

    async banPlayer(id, untilIso) {
      const result = await db
        .prepare('UPDATE players SET banned = 1, banned_until = ? WHERE id = ?')
        .bind(untilIso, id)
        .run()
      return result.meta.changes > 0
    },

    async unbanPlayer(id) {
      const result = await db
        .prepare(
          'UPDATE players SET banned = 0, banned_until = NULL WHERE id = ?',
        )
        .bind(id)
        .run()
      return result.meta.changes > 0
    },

    async banIpHash(ipHash, options) {
      await db
        .prepare(
          `INSERT INTO banned_ip_hashes (ip_hash, reason, banned_by, expires_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(ip_hash) DO UPDATE SET
             reason = excluded.reason,
             banned_by = excluded.banned_by,
             expires_at = excluded.expires_at,
             updated_at = ${NOW}`,
        )
        .bind(ipHash, options.reason, options.bannedBy, options.untilIso)
        .run()
      const result = await db
        .prepare(
          'UPDATE players SET banned = 1, banned_until = ? WHERE ip_hash = ?',
        )
        .bind(options.untilIso, ipHash)
        .run()
      return result.meta.changes
    },

    async unbanIpHash(ipHash) {
      const result = await db
        .prepare('DELETE FROM banned_ip_hashes WHERE ip_hash = ?')
        .bind(ipHash)
        .run()
      return result.meta.changes > 0
    },

    async isIpBanned(ipHash) {
      const row = await db
        .prepare(
          `SELECT ip_hash AS ipHash, reason, banned_by AS bannedBy,
                  expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt
           FROM banned_ip_hashes
           WHERE ip_hash = ? AND (expires_at IS NULL OR expires_at > ${NOW})`,
        )
        .bind(ipHash)
        .first<AdminIpBanRow>()
      return row ?? null
    },

    async listBannedIps() {
      const rows = await db
        .prepare(
          `SELECT ip_hash AS ipHash, reason, banned_by AS bannedBy,
                  expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt
           FROM banned_ip_hashes
           ORDER BY updated_at DESC
           LIMIT 200`,
        )
        .all<AdminIpBanRow>()
      return rows.results
    },

    async countPlayersByIp(ipHash) {
      const row = await db
        .prepare('SELECT COUNT(*) AS count FROM players WHERE ip_hash = ?')
        .bind(ipHash)
        .first<{ count: number }>()
      return row?.count ?? 0
    },

    async hidePlayerScores(id, dateKey) {
      if (dateKey) {
        const result = await db
          .prepare(
            `UPDATE scores SET hidden_at = ${NOW} WHERE player_id = ? AND hidden_at IS NULL AND date_key = ?`,
          )
          .bind(id, dateKey)
          .run()
        return result.meta.changes
      }
      const result = await db
        .prepare(
          `UPDATE scores SET hidden_at = ${NOW} WHERE player_id = ? AND hidden_at IS NULL`,
        )
        .bind(id)
        .run()
      return result.meta.changes
    },

    async unhidePlayerScores(id, dateKey) {
      if (dateKey) {
        const result = await db
          .prepare(
            'UPDATE scores SET hidden_at = NULL WHERE player_id = ? AND hidden_at IS NOT NULL AND date_key = ?',
          )
          .bind(id, dateKey)
          .run()
        return result.meta.changes
      }
      const result = await db
        .prepare(
          'UPDATE scores SET hidden_at = NULL WHERE player_id = ? AND hidden_at IS NOT NULL',
        )
        .bind(id)
        .run()
      return result.meta.changes
    },

    async recordAudit(entry) {
      await db
        .prepare(
          `INSERT INTO admin_audit_logs
             (actor_provider, actor_subject, action, target_type, target_id,
              reason, before_json, after_json, affected_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          entry.actorProvider,
          entry.actorSubject,
          entry.action,
          entry.targetType,
          entry.targetId,
          entry.reason,
          entry.beforeJson,
          entry.afterJson,
          entry.affectedCount,
        )
        .run()
    },

    async listAuditLogs(limit, offset) {
      const rows = await db
        .prepare(
          `SELECT id, actor_provider AS actorProvider, actor_subject AS actorSubject,
                  action, target_type AS targetType, target_id AS targetId,
                  reason, before_json AS beforeJson, after_json AS afterJson,
                  affected_count AS affectedCount, created_at AS createdAt
           FROM admin_audit_logs
           ORDER BY id DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(limit, offset)
        .all<AdminAuditRow>()
      return rows.results
    },

    async listIdentities() {
      const rows = await db
        .prepare(
          `SELECT provider, subject, email, display_name AS displayName,
                  approved_at AS approvedAt, approved_by AS approvedBy,
                  revoked_at AS revokedAt, created_at AS createdAt,
                  ${environment === 'staging' ? 'last_seen_at' : 'NULL'} AS lastSeenAt
           FROM ${identityTable}
           ORDER BY
             CASE WHEN approved_at IS NULL THEN 0
                  WHEN revoked_at IS NULL THEN 1 ELSE 2 END,
             created_at DESC`,
        )
        .all<AdminIdentityRow>()
      return rows.results
    },

    async getIdentity(provider, subject) {
      const row = await db
        .prepare(
          `SELECT provider, subject, email, display_name AS displayName,
                  approved_at AS approvedAt, approved_by AS approvedBy,
                  revoked_at AS revokedAt, created_at AS createdAt,
                  ${environment === 'staging' ? 'last_seen_at' : 'NULL'} AS lastSeenAt
           FROM ${identityTable} WHERE provider = ? AND subject = ?`,
        )
        .bind(provider, subject)
        .first<AdminIdentityRow>()
      return row ?? null
    },

    async approveIdentity(provider, subject, approvedBy) {
      const result = await db
        .prepare(
          `UPDATE ${identityTable}
           SET approved_at = ${NOW}, approved_by = ?, revoked_at = NULL
           WHERE provider = ? AND subject = ?`,
        )
        .bind(approvedBy, provider, subject)
        .run()
      return result.meta.changes > 0
    },

    async revokeIdentity(provider, subject) {
      const result = await db
        .prepare(
          `UPDATE ${identityTable} SET revoked_at = ${NOW}
           WHERE provider = ? AND subject = ?`,
        )
        .bind(provider, subject)
        .run()
      return result.meta.changes > 0
    },

    async countAllowedIdentities() {
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS count FROM ${identityTable}
           WHERE approved_at IS NOT NULL AND revoked_at IS NULL`,
        )
        .first<{ count: number }>()
      return row?.count ?? 0
    },
  }
}
