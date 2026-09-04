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
import { parseEnv } from './env.ts'
import type { EnvValidationResult, RuntimeEnv } from './env.ts'
import { handlePreviewAuth } from './preview-auth.ts'
import {
  friendCodeSchema,
  deletionCodeSchema,
  leaderboardQuerySchema,
  nameSchema,
  registerSchema,
  scoreSubmissionSchema,
  weeklyLeaderboardQuerySchema,
} from './schemas.ts'

export type Env = RuntimeEnv & {
  DB: D1Database
  DAILY_CACHE: KVNamespace
  ASSETS?: Fetcher
}

const envValidationCache = new WeakMap<object, EnvValidationResult>()

function parseEnvironment(env: Env): EnvValidationResult {
  const cached = envValidationCache.get(env)
  if (cached) return cached
  const result = parseEnv(env)
  envValidationCache.set(env, result)
  return result
}

function noStore(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'private, no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
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
const LEGAL_PATHS = new Set(['/privacy', '/terms', '/account-deletion'])

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

function htmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ] ?? character,
  )
}

function legalLayout(title: string, content: string, env: Env): Response {
  const developer = htmlEscape(env.LEGAL_DEVELOPER_NAME ?? 'Kajima')
  const email = htmlEscape(env.LEGAL_CONTACT_EMAIL ?? 'kajima37@example.com')
  return new Response(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)} | TEN.</title><style>body{font-family:system-ui,sans-serif;line-height:1.7;max-width:760px;margin:0 auto;padding:24px;color:#202124}a{color:#155eef}code{word-break:break-all}section{margin:2rem 0}small{color:#666}</style></head><body><header><a href="/">TEN.</a></header>${content}<hr><small>${developer} · <a href="mailto:${email}">${email}</a></small></body></html>`,
    { headers: { 'content-type': 'text/html; charset=UTF-8' } },
  )
}

function privacyPage(env: Env): Response {
  return legalLayout(
    'プライバシーポリシー',
    `<h1>プライバシーポリシー</h1><p>最終更新日: 2026年9月4日</p><p>TEN.（以下「本アプリ」）は、${htmlEscape(env.LEGAL_DEVELOPER_NAME ?? 'Kajima')}が提供します。</p><section><h2>収集する情報</h2><p>本アプリは、プレイヤーID、表示名、端末識別子、スコア、プレイ結果、フレンドコードおよびフレンド関係を、ランキングとゲーム機能の提供、不正利用防止のために収集します。送信元IPアドレスは不正利用防止のためハッシュ化して利用します。</p></section><section><h2>広告</h2><p>本アプリはGoogle AdMobを使用します。広告SDKが扱う情報と利用目的は、Googleの最新のポリシーおよび設定に従います。</p></section><section><h2>保存と共有</h2><p>ゲームサーバー上のデータは、サービス提供に必要な期間保存します。広告配信に必要な情報を除き、個人情報を第三者へ販売しません。データは通信時に暗号化されます。</p></section><section><h2>削除</h2><p>アプリの「マイページ」からアカウントを削除できます。アプリを利用できない場合は<a href="/account-deletion">アカウント削除ページ</a>を利用してください。削除するとプレイヤー、スコア、フレンド関連データを削除します。</p></section><section><h2>問い合わせ</h2><p><a href="mailto:${htmlEscape(env.LEGAL_CONTACT_EMAIL ?? 'kajima37@example.com')}">${htmlEscape(env.LEGAL_CONTACT_EMAIL ?? 'kajima37@example.com')}</a></p></section>`,
    env,
  )
}

function termsPage(env: Env): Response {
  return legalLayout(
    '利用規約',
    `<h1>利用規約</h1><p>最終更新日: 2026年9月4日</p><section><h2>利用</h2><p>本アプリは個人で楽しむゲームサービスです。利用者は、他の利用者やサービスに損害を与える行為、不正な操作、過度な負荷をかける行為をしてはいけません。</p></section><section><h2>ランキング</h2><p>不正利用が確認されたスコアは非表示または削除することがあります。</p></section><section><h2>変更・停止</h2><p>運営上必要な場合、機能の変更、停止、データの削除を行うことがあります。</p></section><section><h2>問い合わせ</h2><p><a href="mailto:${htmlEscape(env.LEGAL_CONTACT_EMAIL ?? 'kajima37@example.com')}">${htmlEscape(env.LEGAL_CONTACT_EMAIL ?? 'kajima37@example.com')}</a></p></section>`,
    env,
  )
}

function deletionPage(env: Env, code: string): Response {
  const escapedCode = htmlEscape(code)
  return legalLayout(
    'アカウント削除',
    `<h1>アカウント削除</h1><p>削除コードを確認し、下のボタンを押してください。プレイヤー、スコア、フレンド関連データは復元できません。</p><form method="post" action="/api/account/delete"><input type="hidden" name="deletionCode" value="${escapedCode}"><button type="submit">アカウントを削除する</button></form><p><a href="/privacy">プライバシーポリシー</a></p>`,
    env,
  )
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

  const activePlayer: MiddlewareHandler<AppContext> = async (c, next) => {
    const store = c.get('store')
    const player = await store.getPlayer(c.get('playerId'))
    if (!player || isPlayerBanned(player))
      return c.json({ error: 'forbidden' }, 403)
    if (await store.isIpBanned(c.get('ipHash')))
      return c.json({ error: 'forbidden' }, 403)
    await next()
  }

  app.get('/api/health', (c) =>
    c.json({ status: 'ok', version: c.env.DEPLOY_VERSION ?? null }),
  )

  app.post('/api/auth/register', jsonValidator(registerSchema), async (c) => {
    const body = c.req.valid('json')
    const store = c.get('store')
    const ipHash = c.get('ipHash')
    const deviceId = body.deviceId.trim()
    const name = (body.name ?? '').trim() || 'Player'

    if (await store.isIpBanned(ipHash)) {
      return c.json({ error: 'forbidden' }, 403)
    }

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

  app.post('/api/daily/start', authPlayer, activePlayer, async (c) => {
    const playerId = c.get('playerId')
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

  app.get('/api/me/deletion-code', authPlayer, async (c) => {
    return c.json({
      deletionCode: await signToken(c.get('playerId'), c.env.AUTH_SECRET),
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

  app.delete('/api/me', authPlayer, async (c) => {
    const deleted = await c.get('store').deletePlayer(c.get('playerId'))
    if (!deleted) return c.json({ error: 'unknown player' }, 404)
    return c.json({ deleted: true as const })
  })

  app.post('/api/account/delete', async (c) => {
    const contentType = c.req.header('content-type') ?? ''
    const body = contentType.includes('application/json')
      ? await c.req.json<unknown>()
      : await c.req.parseBody()
    const parsed = deletionCodeSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'validation failed' }, 400)
    const playerId = await verifyToken(
      parsed.data.deletionCode,
      c.env.AUTH_SECRET,
    )
    if (!playerId) return c.json({ error: 'invalid deletion code' }, 401)
    const deleted = await c.get('store').deletePlayer(playerId)
    if (!deleted) return c.json({ error: 'unknown player' }, 404)
    return c.html(
      '<!doctype html><meta charset="utf-8"><title>アカウント削除完了</title><p>アカウントを削除しました。このページを閉じてください。</p>',
    )
  })

  app.get('/privacy', (c) => privacyPage(c.env))
  app.get('/terms', (c) => termsPage(c.env))
  app.get('/account-deletion', (c) =>
    deletionPage(c.env, c.req.query('code') ?? ''),
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

  app.notFound((c) => c.json({ error: 'Not Found' }, 404))
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  return app
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const parsed = parseEnvironment(env)
    if (!parsed.ok) {
      console.error(
        'invalid environment configuration:',
        parsed.issues.map((issue) => `${issue.path}: ${issue.message}`),
      )
      return new Response('service is misconfigured', { status: 503 })
    }
    const config = parsed.config
    if (config.previewMode === 'required') {
      const authResponse = await handlePreviewAuth(
        request,
        config.preview,
        env.DB,
      )
      if (authResponse) return authResponse
      const pathname = new URL(request.url).pathname
      if (!pathname.startsWith('/api/') && !LEGAL_PATHS.has(pathname)) {
        if (!env.ASSETS)
          return new Response('assets are not configured', { status: 500 })
        return noStore(await env.ASSETS.fetch(request))
      }
    }
    const response = await createApp((bindings) =>
      createD1Store(bindings.DB),
    ).fetch(request, env)
    return config.previewMode === 'required' ? noStore(response) : response
  },
} satisfies ExportedHandler<Env>
