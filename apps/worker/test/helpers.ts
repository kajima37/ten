import type {
  LeaderboardEntry,
  FriendRequestRow,
  FriendRow,
  PlayerAdminRow,
  PlayerRow,
  RankInfo,
  Store,
  UpsertDailyScoreResult,
  WeeklyLeaderboardEntry,
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
    if (event.type !== 'eliminate') {
      if (event.type === 'miss') combo = 0
      continue
    }
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
  const start = await app.request(
    'https://example.com/api/daily/start',
    { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    env,
  )
  const startBody = await readJson<{ startToken: string }>(start)
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
      body: JSON.stringify({
        mode: 'daily',
        dateKey,
        startToken: startBody.startToken,
        events,
        score,
        maxCombo,
      }),
    },
    env,
  )
  return { response, score }
}

export async function startDaily(app: TestApp, env: Env, token: string) {
  const response = await app.request(
    'https://example.com/api/daily/start',
    { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    env,
  )
  return {
    response,
    body: await readJson<{ dateKey: string; startToken: string }>(response),
  }
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
  friendCodes: Map<string, { code: string; expiresAt: string }>
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
  const friendCodes = new Map<string, { code: string; expiresAt: string }>()
  const friendRequests: Array<{
    id: number
    low: string
    high: string
    requestedBy: string
    status: 'pending' | 'accepted' | 'declined'
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

  const streakOf = (playerId: string) => {
    const dates = scoresOf(playerId)
      .map((entry) => entry.dateKey)
      .sort((a, b) => b.localeCompare(a))
    if (!dates.length) return 0
    let streak = 1
    let previous = new Date(`${dates[0]}T00:00:00.000Z`)
    for (const dateKey of dates.slice(1)) {
      previous.setUTCDate(previous.getUTCDate() - 1)
      if (
        new Date(`${dateKey}T00:00:00.000Z`).getTime() !== previous.getTime()
      ) {
        break
      }
      streak += 1
      previous = new Date(`${dateKey}T00:00:00.000Z`)
    }
    return streak
  }

  return {
    players,
    scores,
    logs,
    proofs,
    friendCodes,

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
        const isImproved = score > existing.score
        existing.score = Math.max(existing.score, score)
        if (isImproved) existing.combo = combo
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

    async saveDailyScoreAndProof(playerId, dateKey, score, combo, events) {
      const result = await this.upsertDailyScore(
        playerId,
        dateKey,
        score,
        combo,
      )
      this.proofs.push({ playerId, dateKey, score, events })
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
        .map<LeaderboardEntry>((entry, _index, entries) => ({
          rank:
            entries.findIndex((candidate) => candidate.score === entry.score) +
            1,
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

    async getWeeklyLeaderboard(weekStart, weekEnd, limit, playerIds) {
      const allowed = playerIds ? new Set(playerIds) : null
      const weekly = new Map<
        string,
        { score: number; combo: number; createdAt: string }
      >()
      for (const entry of scores) {
        if (
          entry.mode !== 'daily' ||
          entry.dateKey < weekStart ||
          entry.dateKey >= weekEnd ||
          (allowed && !allowed.has(entry.playerId)) ||
          !isActive(players.get(entry.playerId)!)
        ) {
          continue
        }
        const current = weekly.get(entry.playerId)
        weekly.set(entry.playerId, {
          score: (current?.score ?? 0) + entry.score,
          combo: Math.max(current?.combo ?? 0, entry.combo),
          createdAt: current?.createdAt ?? entry.createdAt,
        })
      }
      const ranked = [...weekly.entries()]
        .sort(
          ([, a], [, b]) =>
            b.score - a.score || a.createdAt.localeCompare(b.createdAt),
        )
        .slice(0, limit)
      return ranked.map<WeeklyLeaderboardEntry>(
        ([playerId, value], _index, entries) => ({
          playerId,
          name: players.get(playerId)?.name ?? 'Player',
          score: value.score,
          combo: value.combo,
          streak: streakOf(playerId),
          rank:
            entries.findIndex(
              ([, candidate]) => candidate.score === value.score,
            ) + 1,
        }),
      )
    },

    async getWeeklyRank(weekStart, weekEnd, score) {
      const entries = await this.getWeeklyLeaderboard(
        weekStart,
        weekEnd,
        Number.MAX_SAFE_INTEGER,
      )
      const above = entries.filter((entry) => entry.score > score).length
      const total = entries.length
      return {
        total,
        rank: above + 1,
        topPercent: total
          ? Math.min(100, Math.max(1, Math.round(((above + 1) / total) * 100)))
          : 100,
      }
    },

    async getWeeklyScore(playerId, weekStart, weekEnd) {
      const player = players.get(playerId)
      if (!player || !isActive(player)) return null
      const total = scoresOf(playerId)
        .filter(
          (entry) => entry.dateKey >= weekStart && entry.dateKey < weekEnd,
        )
        .reduce((sum, entry) => sum + entry.score, 0)
      return total || null
    },

    async getFriendCode(playerId) {
      const value = friendCodes.get(playerId)
      return value && value.expiresAt > new Date().toISOString()
        ? value.code
        : null
    },

    async setFriendCode(playerId, code, expiresAt) {
      for (const [id, value] of friendCodes) {
        if (
          id !== playerId &&
          value.code.toUpperCase() === code.toUpperCase()
        ) {
          throw new Error('duplicate friend code')
        }
      }
      friendCodes.set(playerId, { code, expiresAt })
    },

    async findPlayerByFriendCode(code) {
      for (const [playerId, value] of friendCodes) {
        if (
          value.code.toUpperCase() === code.toUpperCase() &&
          value.expiresAt > new Date().toISOString()
        ) {
          return players.get(playerId) ?? null
        }
      }
      return null
    },

    async createFriendRequest(requesterId, targetId) {
      const [low, high] = [requesterId, targetId].sort()
      if (
        friendRequests.some(
          (request) => request.low === low && request.high === high,
        )
      ) {
        return 'exists'
      }
      friendRequests.push({
        id: friendRequests.length + 1,
        low,
        high,
        requestedBy: requesterId,
        status: 'pending',
      })
      return 'created'
    },

    async respondToFriendRequest(requestId, playerId, status) {
      const request = friendRequests.find((entry) => entry.id === requestId)
      if (
        !request ||
        request.status !== 'pending' ||
        request.requestedBy === playerId ||
        (request.low !== playerId && request.high !== playerId)
      ) {
        return false
      }
      request.status = status
      return true
    },

    async removeFriend(playerId, friendId) {
      const [low, high] = [playerId, friendId].sort()
      const index = friendRequests.findIndex(
        (request) =>
          request.low === low &&
          request.high === high &&
          request.status === 'accepted',
      )
      if (index < 0) return false
      friendRequests.splice(index, 1)
      return true
    },

    async getFriends(playerId) {
      const ids = friendRequests
        .filter(
          (request) =>
            request.status === 'accepted' &&
            (request.low === playerId || request.high === playerId),
        )
        .map((request) =>
          request.low === playerId ? request.high : request.low,
        )
      return ids.flatMap<FriendRow>((id) => {
        const player = players.get(id)
        return player && isActive(player)
          ? [{ id, name: player.name, streak: streakOf(id) }]
          : []
      })
    },

    async getFriendRequests(playerId) {
      return friendRequests.flatMap<FriendRequestRow>((request) => {
        if (
          request.status !== 'pending' ||
          (request.low !== playerId && request.high !== playerId)
        )
          return []
        const otherId = request.low === playerId ? request.high : request.low
        const player = players.get(otherId)
        if (!player || !isActive(player)) return []
        return [
          {
            id: request.id,
            playerId: otherId,
            name: player.name,
            direction:
              request.requestedBy === playerId ? 'outgoing' : 'incoming',
          },
        ]
      })
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
