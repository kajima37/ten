import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'

import {
  getJstDateKey,
  getDailySeed,
  getDailyBoard,
  addDays,
  getJstWeekStartDateKey,
  jstMidnightTtl,
} from './daily.ts'
import { verifyGame } from './verify.ts'
import {
  signDailyStartToken,
  signToken,
  verifyDailyStartToken,
  verifyToken,
  hashIp,
} from './auth.ts'
import { createD1Store } from './db.ts'
import type { Store } from './db.ts'
import {
  adminPlayersQuerySchema,
  friendCodeSchema,
  leaderboardQuerySchema,
  nameSchema,
  registerSchema,
  scoreSubmissionSchema,
  weeklyLeaderboardQuerySchema,
} from './schemas.ts'

export interface Env {
  DB: D1Database
  DAILY_CACHE: KVNamespace
  AUTH_SECRET: string
  ADMIN_SECRET: string
}

type AppContext = {
  Bindings: Env
  Variables: {
    store: Store
    ipHash: string
    playerId: string
  }
}

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
])

const MAX_BODY_BYTES = 65_536
const REGISTRATION_IP_LIMIT = 20
const REGISTRATION_WINDOW_MS = 24 * 60 * 60 * 1000
const SUBMISSION_RATE_LIMIT = 10
const SUBMISSION_IP_RATE_LIMIT = 60
const SUBMISSION_RATE_WINDOW_MS = 60_000
const DAILY_START_TTL_MS = 75_000
const FRIEND_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000

function makeFriendCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

async function issueFriendCode(store: Store, playerId: string) {
  const expiresAt = new Date(Date.now() + FRIEND_CODE_TTL_MS).toISOString()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeFriendCode()
    try {
      await store.setFriendCode(playerId, code, expiresAt)
      return { code, expiresAt }
    } catch {
      // A collision is exceptionally unlikely; retry without exposing it.
    }
  }
  return null
}

function createValidator(type: 'json' | 'query') {
  return <T extends z.ZodType>(schema: T) =>
    zValidator(type, schema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: 'validation failed',
            issues: result.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
          400,
        )
      }
    })
}

const jsonValidator = createValidator('json')
const queryValidator = createValidator('query')

function isPlayerBanned(
  player: {
    banned: number
    bannedUntil: string | null
  },
  now = new Date(),
): boolean {
  if (player.banned !== 1) return false
  return player.bannedUntil === null || new Date(player.bannedUntil) > now
}

export function createApp(storeFactory: (env: Env) => Store): Hono<AppContext> {
  const app = new Hono<AppContext>()

  app.use('*', async (c, next) => {
    c.set('store', storeFactory(c.env))
    c.set(
      'ipHash',
      await hashIp(c.req.header('cf-connecting-ip') ?? '', c.env.AUTH_SECRET),
    )
    await next()
  })

  app.use('*', async (c, next) => {
    const contentLength = Number(c.req.header('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return c.json({ error: 'payload too large' }, 413)
    }
    await next()
  })

  app.use('*', async (c, next) => {
    const origin = c.req.header('Origin')
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      c.header('Access-Control-Allow-Origin', origin)
      c.header('Vary', 'Origin')
    }
    c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    c.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS',
    )
    c.header('Access-Control-Max-Age', '86400')
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204)
    }
    await next()
  })

  const authPlayer: MiddlewareHandler<AppContext> = async (c, next) => {
    const header = c.req.header('Authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null
    const playerId = token ? await verifyToken(token, c.env.AUTH_SECRET) : null
    if (!playerId) return c.json({ error: 'unauthorized' }, 401)
    c.set('playerId', playerId)
    await next()
  }

  const adminAuth: MiddlewareHandler<AppContext> = async (c, next) => {
    const expected = c.env.ADMIN_SECRET
    if (!expected || c.req.header('Authorization') !== `Bearer ${expected}`) {
      return c.json({ error: 'forbidden' }, 403)
    }
    await next()
  }

  const activePlayer: MiddlewareHandler<AppContext> = async (c, next) => {
    const player = await c.get('store').getPlayer(c.get('playerId'))
    if (!player || isPlayerBanned(player))
      return c.json({ error: 'forbidden' }, 403)
    await next()
  }

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.post('/api/auth/register', jsonValidator(registerSchema), async (c) => {
    const body = c.req.valid('json')
    const store = c.get('store')
    const ipHash = c.get('ipHash')
    const deviceId = body.deviceId.trim()
    const name = (body.name ?? '').trim() || 'Player'

    const since = new Date(Date.now() - REGISTRATION_WINDOW_MS).toISOString()
    const recent = await store.countRecentRegistrations(ipHash, since)
    if (recent >= REGISTRATION_IP_LIMIT) {
      return c.json({ error: 'registration rate limited' }, 429)
    }

    const existing = await store.getPlayerByDevice(deviceId)
    const playerId = existing?.id ?? crypto.randomUUID()
    if (!existing) {
      await store.createPlayer(playerId, deviceId, name, ipHash)
      const registered = await store.getPlayerByDevice(deviceId)
      if (!registered) return c.json({ error: 'registration failed' }, 500)
      if (!(await issueFriendCode(store, registered.id))) {
        return c.json({ error: 'registration failed' }, 500)
      }
      return c.json({
        token: await signToken(registered.id, c.env.AUTH_SECRET),
        player: { id: registered.id, name: registered.name },
      })
    }
    if (
      !(await store.getFriendCode(playerId)) &&
      !(await issueFriendCode(store, playerId))
    ) {
      return c.json({ error: 'registration failed' }, 500)
    }
    const token = await signToken(playerId, c.env.AUTH_SECRET)
    return c.json({
      token,
      player: { id: playerId, name: existing.name },
    })
  })

  app.get('/api/daily', async (c) => {
    const env = c.env
    const dateKey = getJstDateKey()

    const cached = await env.DAILY_CACHE.get(dateKey)
    if (cached) return c.json(JSON.parse(cached))

    const payload = { dateKey, board: getDailyBoard(dateKey) }
    await env.DAILY_CACHE.put(dateKey, JSON.stringify(payload), {
      expirationTtl: jstMidnightTtl(),
    })
    return c.json(payload)
  })

  app.post('/api/daily/start', authPlayer, async (c) => {
    const store = c.get('store')
    const playerId = c.get('playerId')
    const player = await store.getPlayer(playerId)
    if (!player || isPlayerBanned(player))
      return c.json({ error: 'forbidden' }, 403)
    const dateKey = getJstDateKey()
    return c.json({
      dateKey,
      board: getDailyBoard(dateKey),
      startToken: await signDailyStartToken(
        playerId,
        dateKey,
        c.env.AUTH_SECRET,
        Date.now() + DAILY_START_TTL_MS,
      ),
    })
  })

  app.post(
    '/api/scores',
    authPlayer,
    activePlayer,
    jsonValidator(scoreSubmissionSchema),
    async (c) => {
      const body = c.req.valid('json')
      const store = c.get('store')
      const playerId = c.get('playerId')
      const ipHash = c.get('ipHash')

      const start = await verifyDailyStartToken(
        body.startToken,
        c.env.AUTH_SECRET,
      )
      if (
        !start ||
        start.playerId !== playerId ||
        start.dateKey !== body.dateKey
      ) {
        return c.json({ error: 'invalid daily start' }, 400)
      }

      const since = new Date(
        Date.now() - SUBMISSION_RATE_WINDOW_MS,
      ).toISOString()
      const recent = await store.countRecentSubmissions(playerId, since)
      if (recent >= SUBMISSION_RATE_LIMIT) {
        return c.json({ error: 'rate limited' }, 429)
      }
      const recentByIp = await store.countRecentSubmissionsByIp(ipHash, since)
      if (recentByIp >= SUBMISSION_IP_RATE_LIMIT) {
        return c.json({ error: 'rate limited' }, 429)
      }
      await store.logSubmission(playerId, ipHash)

      const seed = getDailySeed(body.dateKey)
      let verified: { score: number; combo: number; maxCombo: number }
      try {
        verified = verifyGame(seed, body.events)
      } catch {
        return c.json({ error: 'verification failed' }, 400)
      }
      if (
        verified.score !== body.score ||
        verified.maxCombo !== body.maxCombo
      ) {
        return c.json({ error: 'verification failed' }, 400)
      }

      const result = await store.saveDailyScoreAndProof(
        playerId,
        body.dateKey,
        verified.score,
        verified.maxCombo,
        JSON.stringify(body.events),
      )
      const rank = await store.getRank(body.dateKey, result.best)

      return c.json({
        accepted: true,
        isNewBest: result.isNewBest,
        best: result.best,
        rank: rank.rank,
        topPercent: rank.topPercent,
      })
    },
  )

  app.get(
    '/api/leaderboard/weekly',
    queryValidator(weeklyLeaderboardQuerySchema),
    async (c) => {
      const query = c.req.valid('query')
      const currentWeek = getJstWeekStartDateKey()
      const week = query.week ?? currentWeek
      const weekDate = new Date(`${week}T00:00:00.000Z`)
      const earliestWeek = addDays(currentWeek, -77)
      if (
        Number.isNaN(weekDate.getTime()) ||
        weekDate.getUTCDay() !== 1 ||
        week < earliestWeek ||
        week > currentWeek
      ) {
        return c.json({ error: 'invalid week' }, 400)
      }
      const weekEnd = addDays(week, 7)
      const store = c.get('store')
      const header = c.req.header('Authorization')
      const token = header?.startsWith('Bearer ') ? header.slice(7) : null
      const playerId = token
        ? await verifyToken(token, c.env.AUTH_SECRET)
        : null
      if (query.scope === 'friends' && !playerId) {
        return c.json({ error: 'unauthorized' }, 401)
      }
      if (query.scope === 'friends' && playerId) {
        const player = await store.getPlayer(playerId)
        if (!player || isPlayerBanned(player)) {
          return c.json({ error: 'forbidden' }, 403)
        }
      }
      const friendIds =
        query.scope === 'friends' && playerId
          ? [
              playerId,
              ...(await store.getFriends(playerId)).map((friend) => friend.id),
            ]
          : undefined
      const entries = await store.getWeeklyLeaderboard(
        week,
        weekEnd,
        query.limit ?? 100,
        friendIds,
      )
      let mine: { rank: number; topPercent: number; score: number } | null =
        null
      if (playerId) {
        const score = await store.getWeeklyScore(playerId, week, weekEnd)
        if (score !== null) {
          const rank = await store.getWeeklyRank(
            week,
            weekEnd,
            score,
            friendIds,
          )
          mine = { rank: rank.rank, topPercent: rank.topPercent, score }
        }
      }
      return c.json({
        week,
        total: await store.getWeeklyCount(week, weekEnd, friendIds),
        entries,
        mine,
      })
    },
  )

  app.get(
    '/api/leaderboard',
    queryValidator(leaderboardQuerySchema),
    async (c) => {
      const query = c.req.valid('query')
      const store = c.get('store')
      const dateKey = query.date ?? getJstDateKey()
      const limit = query.limit ?? 100

      const entries = await store.getLeaderboard(dateKey, limit)
      const total = await store.getDailyCount(dateKey)

      const header = c.req.header('Authorization')
      const token = header?.startsWith('Bearer ') ? header.slice(7) : null
      const playerId = token
        ? await verifyToken(token, c.env.AUTH_SECRET)
        : null

      let mine: { rank: number; topPercent: number; score: number } | null =
        null
      if (playerId) {
        const score = await store.getDailyScore(playerId, dateKey)
        if (score !== null) {
          const rank = await store.getRank(dateKey, score)
          mine = { rank: rank.rank, topPercent: rank.topPercent, score }
        }
      }

      return c.json({ date: dateKey, total, entries, mine })
    },
  )

  app.get('/api/me', authPlayer, activePlayer, async (c) => {
    const store = c.get('store')
    const player = await store.getPlayer(c.get('playerId'))
    if (!player) return c.json({ error: 'unknown player' }, 404)
    return c.json({
      id: player.id,
      name: player.name,
      friendCode: await store.getFriendCode(player.id),
    })
  })

  app.patch(
    '/api/me',
    authPlayer,
    activePlayer,
    jsonValidator(nameSchema),
    async (c) => {
      const body = c.req.valid('json')
      const store = c.get('store')
      const playerId = c.get('playerId')
      await store.updatePlayerName(playerId, body.name)
      return c.json({ id: playerId, name: body.name })
    },
  )

  app.post('/api/me/friend-code', authPlayer, activePlayer, async (c) => {
    const store = c.get('store')
    const playerId = c.get('playerId')
    const code = await issueFriendCode(store, playerId)
    if (code) return c.json(code)
    return c.json({ error: 'could not create friend code' }, 503)
  })

  app.post(
    '/api/friend-requests',
    authPlayer,
    activePlayer,
    jsonValidator(friendCodeSchema),
    async (c) => {
      const store = c.get('store')
      const playerId = c.get('playerId')
      const target = await store.findPlayerByFriendCode(
        c.req.valid('json').friendCode.toUpperCase(),
      )
      if (!target || isPlayerBanned(target))
        return c.json({ error: 'invalid friend code' }, 404)
      if (target.id === playerId)
        return c.json({ error: 'cannot add yourself' }, 400)
      const result = await store.createFriendRequest(playerId, target.id)
      return c.json({ status: result }, result === 'created' ? 201 : 200)
    },
  )

  app.post(
    '/api/friend-requests/:id/:action',
    authPlayer,
    activePlayer,
    async (c) => {
      const action = c.req.param('action')
      if (action !== 'accept' && action !== 'decline') {
        return c.json({ error: 'not found' }, 404)
      }
      const requestId = Number(c.req.param('id'))
      if (!Number.isSafeInteger(requestId) || requestId < 1) {
        return c.json({ error: 'invalid request' }, 400)
      }
      const updated = await c
        .get('store')
        .respondToFriendRequest(
          requestId,
          c.get('playerId'),
          action === 'accept' ? 'accepted' : 'declined',
        )
      if (!updated) return c.json({ error: 'request not found' }, 404)
      return c.json({ status: action === 'accept' ? 'accepted' : 'declined' })
    },
  )

  app.delete('/api/friends/:id', authPlayer, activePlayer, async (c) => {
    const removed = await c
      .get('store')
      .removeFriend(c.get('playerId'), c.req.param('id'))
    if (!removed) return c.json({ error: 'friend not found' }, 404)
    return c.json({ removed: true })
  })

  app.get('/api/friends', authPlayer, activePlayer, async (c) => {
    const store = c.get('store')
    const playerId = c.get('playerId')
    return c.json({
      friends: await store.getFriends(playerId),
      requests: await store.getFriendRequests(playerId),
    })
  })

  app.use('/api/admin/*', adminAuth)

  app.get(
    '/api/admin/players',
    queryValidator(adminPlayersQuerySchema),
    async (c) => {
      const store = c.get('store')
      const { ipHash } = c.req.valid('query')
      const players = await store.findPlayersByIp(ipHash)
      return c.json({ players })
    },
  )

  app.post('/api/admin/players/:id/ban', async (c) => {
    const store = c.get('store')
    const playerId = c.req.param('id')
    await store.banPlayer(playerId, null)
    return c.json({ banned: playerId })
  })

  app.post('/api/admin/players/:id/unban', async (c) => {
    const store = c.get('store')
    const playerId = c.req.param('id')
    await store.unbanPlayer(playerId)
    return c.json({ unbanned: playerId })
  })

  app.post('/api/admin/ip/:ipHash/ban', async (c) => {
    const store = c.get('store')
    const ipHash = c.req.param('ipHash')
    const count = await store.banPlayersByIp(ipHash, null)
    return c.json({ banned: count })
  })

  app.delete('/api/admin/players/:id/scores', async (c) => {
    const store = c.get('store')
    const playerId = c.req.param('id')
    const dateKey = c.req.query('date')
    const count = await store.deletePlayerScores(playerId, dateKey)
    return c.json({ deleted: count })
  })

  app.notFound((c) => c.json({ error: 'Not Found' }, 404))
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  return app
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return createApp((bindings) => createD1Store(bindings.DB)).fetch(
      request,
      env,
    )
  },
} satisfies ExportedHandler<Env>
