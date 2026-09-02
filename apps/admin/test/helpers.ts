import { SignJWT } from 'jose'

import type {
  AdminAuditEntry,
  AdminAuditRow,
  AdminIpBanOptions,
  AdminIpBanRow,
  AdminIdentityRow,
  AdminPlayerDetail,
  AdminPlayerSummary,
  AdminScoreRow,
  AdminSearchQuery,
  AdminStore,
} from '../src/worker/store.ts'

export const SESSION_SECRET = 'admin-session-secret'

export type MemoryPlayer = {
  id: string
  name: string
  ipHash: string | null
  banned: number
  bannedUntil: string | null
  createdAt: string
  scores: Array<{
    dateKey: string
    score: number
    combo: number
    createdAt: string
    hiddenAt: string | null
  }>
}

export type MemoryAdminStore = AdminStore & {
  players: Map<string, MemoryPlayer>
  ipBans: Map<string, AdminIpBanRow>
  audits: Array<AdminAuditEntry>
  identities: Map<string, AdminIdentityRow>
}

function summaryOf(player: MemoryPlayer): AdminPlayerSummary {
  return {
    id: player.id,
    name: player.name,
    ipHash: player.ipHash,
    banned: player.banned,
    bannedUntil: player.bannedUntil,
    createdAt: player.createdAt,
    scoreCount: player.scores.length,
    hiddenCount: player.scores.filter((score) => score.hiddenAt !== null)
      .length,
  }
}

export function createMemoryAdminStore(): MemoryAdminStore {
  const players = new Map<string, MemoryPlayer>()
  const ipBans = new Map<string, AdminIpBanRow>()
  const audits: Array<AdminAuditEntry & { id: number }> = []
  const identities = new Map<string, AdminIdentityRow>()

  return {
    players,
    ipBans,
    audits,
    identities,

    async searchPlayers(query: AdminSearchQuery) {
      const results: Array<AdminPlayerSummary> = []
      for (const player of players.values()) {
        if (
          query.playerId
            ? player.id === query.playerId
            : query.ipHash
              ? player.ipHash === query.ipHash
              : query.name
                ? player.name.includes(query.name)
                : false
        ) {
          results.push(summaryOf(player))
        }
        if (results.length >= query.limit) break
      }
      return results
    },

    async getPlayerDetail(id) {
      const player = players.get(id)
      if (!player) return null
      const detail: AdminPlayerDetail = {
        id: player.id,
        name: player.name,
        ipHash: player.ipHash,
        banned: player.banned,
        bannedUntil: player.bannedUntil,
        createdAt: player.createdAt,
        scores: player.scores.map((score): AdminScoreRow => ({ ...score })),
      }
      return detail
    },

    async banPlayer(id, untilIso) {
      const player = players.get(id)
      if (!player) return false
      players.set(id, { ...player, banned: 1, bannedUntil: untilIso })
      return true
    },

    async unbanPlayer(id) {
      const player = players.get(id)
      if (!player) return false
      players.set(id, { ...player, banned: 0, bannedUntil: null })
      return true
    },

    async banIpHash(ipHash, options: AdminIpBanOptions) {
      const existing = ipBans.get(ipHash)
      const now = new Date().toISOString()
      ipBans.set(ipHash, {
        ipHash,
        reason: options.reason,
        bannedBy: options.bannedBy,
        expiresAt: options.untilIso,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      let affected = 0
      for (const player of players.values()) {
        if (player.ipHash === ipHash) {
          players.set(player.id, {
            ...player,
            banned: 1,
            bannedUntil: options.untilIso,
          })
          affected += 1
        }
      }
      return affected
    },

    async unbanIpHash(ipHash) {
      return ipBans.delete(ipHash)
    },

    async isIpBanned(ipHash) {
      const ban = ipBans.get(ipHash)
      if (!ban) return null
      if (ban.expiresAt !== null && new Date(ban.expiresAt) <= new Date()) {
        return null
      }
      return ban
    },

    async listBannedIps() {
      return [...ipBans.values()].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )
    },

    async countPlayersByIp(ipHash) {
      let count = 0
      for (const player of players.values()) {
        if (player.ipHash === ipHash) count += 1
      }
      return count
    },

    async hidePlayerScores(id, dateKey) {
      const player = players.get(id)
      if (!player) return 0
      const now = new Date().toISOString()
      let count = 0
      players.set(id, {
        ...player,
        scores: player.scores.map((score) => {
          if (
            score.hiddenAt === null &&
            (dateKey === null || score.dateKey === dateKey)
          ) {
            count += 1
            return { ...score, hiddenAt: now }
          }
          return score
        }),
      })
      return count
    },

    async unhidePlayerScores(id, dateKey) {
      const player = players.get(id)
      if (!player) return 0
      let count = 0
      players.set(id, {
        ...player,
        scores: player.scores.map((score) => {
          if (
            score.hiddenAt !== null &&
            (dateKey === null || score.dateKey === dateKey)
          ) {
            count += 1
            return { ...score, hiddenAt: null }
          }
          return score
        }),
      })
      return count
    },

    async recordAudit(entry: AdminAuditEntry) {
      audits.push({ ...entry, id: audits.length + 1 })
    },

    async listAuditLogs(limit, offset) {
      const rows: Array<AdminAuditRow> = audits
        .slice()
        .reverse()
        .map((entry) => ({
          ...entry,
          createdAt: new Date().toISOString(),
        }))
      return rows.slice(offset, offset + limit)
    },

    async listIdentities() {
      return [...identities.values()].sort((a, b) => {
        const status = (identity: AdminIdentityRow) =>
          identity.approvedAt === null ? 0 : identity.revokedAt === null ? 1 : 2
        return status(a) - status(b) || b.createdAt.localeCompare(a.createdAt)
      })
    },

    async getIdentity(provider, subject) {
      return identities.get(`${provider}:${subject}`) ?? null
    },

    async approveIdentity(provider, subject, approvedBy) {
      const key = `${provider}:${subject}`
      const identity = identities.get(key)
      if (!identity) return false
      identities.set(key, {
        ...identity,
        approvedAt: new Date().toISOString(),
        approvedBy,
        revokedAt: null,
      })
      return true
    },

    async revokeIdentity(provider, subject) {
      const key = `${provider}:${subject}`
      const identity = identities.get(key)
      if (!identity) return false
      identities.set(key, { ...identity, revokedAt: new Date().toISOString() })
      return true
    },

    async countAllowedIdentities() {
      return [...identities.values()].filter(
        (identity) =>
          identity.approvedAt !== null && identity.revokedAt === null,
      ).length
    },
  }
}

export function seedIdentity(
  store: MemoryAdminStore,
  overrides: Partial<AdminIdentityRow> & { provider: string; subject: string },
): AdminIdentityRow {
  const identity: AdminIdentityRow = {
    email: null,
    displayName: null,
    approvedAt: null,
    approvedBy: null,
    revokedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    lastSeenAt: null,
    ...overrides,
  }
  store.identities.set(`${identity.provider}:${identity.subject}`, identity)
  return identity
}

export type AuthIdentitySeed = {
  provider: string
  subject: string
  approvedAt?: string | null
  revokedAt?: string | null
}

export function createAuthDb(
  previewIdentities: Array<AuthIdentitySeed> = [],
  adminIdentities: Array<AuthIdentitySeed> = [],
  sessions: Array<{
    id: string
    provider: string
    subject: string
    expiresAt?: string
    revokedAt?: string | null
  }> = [],
): D1Database {
  const preview = new Map(
    previewIdentities.map((row) => [`${row.provider}:${row.subject}`, row]),
  )
  const admin = new Map(
    adminIdentities.map((row) => [`${row.provider}:${row.subject}`, row]),
  )
  const sessionMap = new Map(
    sessions.map((row) => [
      row.id,
      {
        provider: row.provider,
        subject: row.subject,
        expiresAt: row.expiresAt ?? '2099-01-01T00:00:00.000Z',
        revokedAt: row.revokedAt ?? null,
      },
    ]),
  )

  const db = {
    prepare(sql: string) {
      const query = sql.replace(/\s+/g, ' ').trim()
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (query.includes('FROM oauth_sessions s')) {
                const [sid, now] = args as [string, string]
                const row = sessionMap.get(sid)
                if (!row || row.revokedAt !== null || row.expiresAt <= now)
                  return null
                return { provider: row.provider, subject: row.subject } as T
              }
              if (query.includes('FROM preview_identities')) {
                const [provider, subject] = args as [string, string]
                const row = preview.get(`${provider}:${subject}`)
                if (!row) return null
                return {
                  approvedAt: row.approvedAt ?? null,
                  revokedAt: row.revokedAt ?? null,
                } as T
              }
              if (query.includes('FROM admin_identities')) {
                const [provider, subject] = args as [string, string]
                const row = admin.get(`${provider}:${subject}`)
                if (!row) return null
                return {
                  approvedAt: row.approvedAt ?? null,
                  revokedAt: row.revokedAt ?? null,
                } as T
              }
              return null
            },
            async all<T>() {
              return { results: [] as Array<T> }
            },
            async run() {
              return { meta: { changes: 0 } }
            },
          }
        },
      }
    },
  } as unknown as D1Database
  return Object.assign(db, { sessions: sessionMap, preview, admin })
}

export async function sessionCookie(
  sid: string,
  secret = SESSION_SECRET,
): Promise<string> {
  const token = await new SignJWT({ sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(new TextEncoder().encode(secret))
  return `__Host-ten-admin-session=${token}`
}

export function testAdminEnv(
  options: {
    environment?: 'staging' | 'production'
    db?: D1Database
  } = {},
): { env: Record<string, unknown> } {
  return {
    env: {
      DB: options.db ?? createAuthDb(),
      ENVIRONMENT: options.environment ?? 'staging',
      ADMIN_SESSION_SECRET: SESSION_SECRET,
      GITHUB_OAUTH_CLIENT_ID: 'github-client-id',
      GITHUB_OAUTH_CLIENT_SECRET: 'github-client-secret',
    },
  }
}

export function seedPlayer(
  store: MemoryAdminStore,
  overrides: Partial<MemoryPlayer> & { id: string },
): MemoryPlayer {
  const player: MemoryPlayer = {
    name: 'Player',
    ipHash: 'ip-hash-1',
    banned: 0,
    bannedUntil: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    scores: [],
    ...overrides,
  }
  store.players.set(player.id, player)
  return player
}
