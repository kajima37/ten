import type {
  LeaderboardEntry,
  PlayerAdminRow,
  PlayerRow,
  RankInfo,
  Store,
  UpsertDailyScoreResult,
} from '../src/db.ts'

import {
  makeBoard,
  collapseBoard,
  mulberry32,
  findCombination,
} from '@ten/game-core'
import type { GameEvent } from '@ten/game-core'

import { createApp } from '../src/index.ts'
import type { Env } from '../src/index.ts'

export type TestApp = ReturnType<typeof createApp>
export type TestStore = ReturnType<typeof createMemoryStore>

export function createTestContext() {
  const store = createMemoryStore()
  const env = testEnv().env
  const app = createApp(() => store)
  return { app, store, env }
}

export async function register(
  app: TestApp,
  env: Env,
  deviceId: string,
  options: { name?: string; ip?: string } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.ip) headers['cf-connecting-ip'] = options.ip
  const response = await app.request(
    'https://example.com/api/auth/register',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ deviceId, name: options.name }),
    },
    env,
  )
  const body = await readJson<{
    token: string
    player: { id: string; name: string }
  }>(response)
  return { response, body, token: body.token, playerId: body.player.id }
}

export function simulateDailyGame(
  seed: number,
  steps: number,
): Array<GameEvent> {
  const random = mulberry32(seed)
  let board = makeBoard(random)
  const events: Array<GameEvent> = []
  for (let index = 0; index < steps; index += 1) {
    const path = findCombination(board)
    if (!path) break
    events.push({ type: 'eliminate', cells: path })
    board = collapseBoard(board, path, random)
  }
  return events
}

export function computeOutcome(events: Array<GameEvent>) {
  let combo = 0
  let maxCombo = 0
  let score = 0
  for (const event of events) {
    if (event.type === 'shuffle') continue
    combo += 1
    maxCombo = Math.max(maxCombo, combo)
    score += event.cells.length * 100 + (combo - 1) * 50
  }
  return { score, maxCombo }
}

export async function submitDaily(
  app: TestApp,
  env: Env,
  token: string,
  dateKey: string,
  seed: number,
  steps: number,
) {
  const events = simulateDailyGame(seed, steps)
  const { score, maxCombo } = computeOutcome(events)
  const response = await app.request(
    'https://example.com/api/scores',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ mode: 'daily', dateKey, events, score, maxCombo }),
    },
    env,
  )
  return { response, score }
}

export type StoredScore = {
  playerId: string
  mode: string
  dateKey: string
  score: number
  combo: number
  createdAt: string
}

export function createMemoryStore(): Store & {
  players: Map<string, PlayerRow>
  scores: Array<StoredScore>
  logs: Array<string>
  proofs: Array<{
    playerId: string
    dateKey: string
    score: number
    events: string
  }>
} {
  const players = new Map<string, PlayerRow>()
  const scores: Array<StoredScore> = []
  const logs: Array<string> = []
  const proofs: Array<{
    playerId: string
    dateKey: string
    score: number
    events: string
  }> = []

  const isActive = (player: PlayerRow): boolean => {
    if (player.banned !== 1) return true
    return (
      player.bannedUntil !== null && new Date(player.bannedUntil) <= new Date()
    )
  }

  const dailyOf = (dateKey: string) =>
    scores.filter(
      (entry) => entry.mode === 'daily' && entry.dateKey === dateKey,
    )

  const scoresOf = (playerId: string) =>
    scores.filter(
      (entry) => entry.playerId === playerId && entry.mode === 'daily',
    )

  return {
    players,
    scores,
    logs,
    proofs,

    async getPlayer(id) {
      return players.get(id) ?? null
    },

    async getPlayerByDevice(deviceId) {
      for (const player of players.values()) {
        if (player.deviceId === deviceId) return player
      }
      return null
    },

    async createPlayer(playerId, deviceId, name, ipHash) {
      if (!players.has(playerId)) {
        players.set(playerId, {
          id: playerId,
          name,
          deviceId,
          ipHash,
          banned: 0,
          bannedUntil: null,
          createdAt: new Date().toISOString(),
        })
      }
    },

    async updatePlayerName(id, name) {
      const player = players.get(id)
      if (player) players.set(id, { ...player, name })
    },

    async countRecentRegistrations(ipHash, sinceIso) {
      let count = 0
      for (const player of players.values()) {
        if (player.ipHash === ipHash && player.createdAt >= sinceIso) count += 1
      }
      return count
    },

    async upsertDailyScore(playerId, dateKey, score, combo) {
      const existing = dailyOf(dateKey).find(
        (entry) => entry.playerId === playerId,
      )
      let isNewBest = true
      if (existing) {
        isNewBest = score > existing.score
        existing.score = Math.max(existing.score, score)
        existing.combo = combo
      } else {
        scores.push({
          playerId,
          mode: 'daily',
          dateKey,
          score,
          combo,
          createdAt: new Date().toISOString(),
        })
      }
      const best =
        existing?.score ??
        dailyOf(dateKey).find((entry) => entry.playerId === playerId)?.score ??
        score
      const result: UpsertDailyScoreResult = { isNewBest, best }
      return result
    },

    async getLeaderboard(dateKey, limit) {
      const active = new Set(
        [...players.values()].filter(isActive).map((player) => player.id),
      )
      const ranked = dailyOf(dateKey)
        .filter((entry) => active.has(entry.playerId))
        .sort(
          (a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt),
        )
        .slice(0, limit)
        .map<LeaderboardEntry>((entry, index) => ({
          rank: index + 1,
          playerId: entry.playerId,
          name: players.get(entry.playerId)?.name ?? 'Player',
          score: entry.score,
          combo: entry.combo,
        }))
      return ranked
    },

    async getRank(dateKey, score) {
      const active = new Set(
        [...players.values()].filter(isActive).map((player) => player.id),
      )
      const daily = dailyOf(dateKey).filter((entry) =>
        active.has(entry.playerId),
      )
      const above = daily.filter((entry) => entry.score > score).length
      const total = daily.length
      const rank = above + 1
      const result: RankInfo = {
        total,
        rank,
        topPercent:
          total > 0
            ? Math.min(100, Math.max(1, Math.round((rank / total) * 100)))
            : 100,
      }
      return result
    },

    async getDailyCount(dateKey) {
      const active = new Set(
        [...players.values()].filter(isActive).map((player) => player.id),
      )
      return dailyOf(dateKey).filter((entry) => active.has(entry.playerId))
        .length
    },

    async getDailyScore(playerId, dateKey) {
      const player = players.get(playerId)
      if (!player || !isActive(player)) return null
      return (
        dailyOf(dateKey).find((entry) => entry.playerId === playerId)?.score ??
        null
      )
    },

    async countRecentSubmissions(playerId, sinceIso) {
      return logs.filter(
        (entry) =>
          entry.startsWith(playerId) && entry > `${playerId}:${sinceIso}`,
      ).length
    },

    async countRecentSubmissionsByIp(ipHash, sinceIso) {
      return logs.filter((entry) => {
        const [pid, ip, time] = entry.split('|')
        return pid === 'ip' && ip === ipHash && time >= sinceIso
      }).length
    },

    async logSubmission(playerId, ipHash) {
      logs.push(`ip|${ipHash}|${new Date().toISOString()}`)
      logs.push(`${playerId}:${new Date().toISOString()}`)
    },

    async saveScoreProof(playerId, dateKey, score, events) {
      proofs.push({ playerId, dateKey, score, events })
    },

    async banPlayer(playerId, untilIso) {
      const player = players.get(playerId)
      if (player)
        players.set(playerId, { ...player, banned: 1, bannedUntil: untilIso })
    },

    async unbanPlayer(playerId) {
      const player = players.get(playerId)
      if (player)
        players.set(playerId, { ...player, banned: 0, bannedUntil: null })
    },

    async banPlayersByIp(ipHash, untilIso) {
      let count = 0
      for (const player of players.values()) {
        if (player.ipHash === ipHash) {
          players.set(player.id, {
            ...player,
            banned: 1,
            bannedUntil: untilIso,
          })
          count += 1
        }
      }
      return count
    },

    async findPlayersByIp(ipHash) {
      const rows: Array<PlayerAdminRow> = []
      for (const player of players.values()) {
        if (player.ipHash === ipHash) {
          rows.push({
            id: player.id,
            name: player.name,
            ipHash: player.ipHash,
            banned: player.banned,
            createdAt: player.createdAt,
            scores: scoresOf(player.id)
              .map((entry) => ({
                dateKey: entry.dateKey,
                score: entry.score,
                combo: entry.combo,
                createdAt: entry.createdAt,
              }))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          })
        }
      }
      return rows
    },

    async deletePlayerScores(playerId, dateKey) {
      const before = scores.length
      for (let index = scores.length - 1; index >= 0; index -= 1) {
        const entry = scores[index]
        if (
          entry.playerId === playerId &&
          (dateKey === undefined || entry.dateKey === dateKey)
        ) {
          scores.splice(index, 1)
        }
      }
      for (let index = proofs.length - 1; index >= 0; index -= 1) {
        const entry = proofs[index]
        if (
          entry.playerId === playerId &&
          (dateKey === undefined || entry.dateKey === dateKey)
        ) {
          proofs.splice(index, 1)
        }
      }
      return before - scores.length
    },
  }
}

export function createKvMock(): KVNamespace {
  const values = new Map<string, string>()
  return {
    async get(key: string) {
      return values.get(key) ?? null
    },
    async put(key: string, value: string, options?: unknown) {
      const ttl = (options as { expirationTtl?: number } | undefined)
        ?.expirationTtl
      void ttl
      values.set(key, value)
    },
    async delete(key: string) {
      values.delete(key)
    },
  } as unknown as KVNamespace
}

export function testEnv() {
  return {
    env: {
      DB: {} as unknown as D1Database,
      DAILY_CACHE: createKvMock(),
      AUTH_SECRET: 'test-secret',
      ADMIN_SECRET: 'admin-secret',
    },
  }
}

export async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json()
  return data as T
}

export function jsonInit(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  return { ...init, headers }
}
