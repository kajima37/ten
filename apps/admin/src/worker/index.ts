import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { handleAuthRoutes, loginPageResponse, requireSession } from '@ten/oauth'
import type { OAuthIdentity } from '@ten/oauth'

import { adminHooks, identityLabel, oauthConfig } from './auth.ts'
import { parseEnv } from './env.ts'
import type { EnvValidationResult, RuntimeEnv } from './env.ts'
import { createD1AdminStore } from './store.ts'
import type { AdminStore } from './store.ts'
import {
  auditQuerySchema,
  banSchema,
  reasonSchema,
  scoreActionSchema,
  searchQuerySchema,
} from './schemas.ts'

export type AdminEnv = RuntimeEnv & {
  DB: D1Database
  ASSETS?: Fetcher
}

type AppContext = {
  Bindings: AdminEnv
  Variables: {
    identity: OAuthIdentity
    store: AdminStore
  }
}

const envValidationCache = new WeakMap<object, EnvValidationResult>()

function parseEnvironment(env: AdminEnv): EnvValidationResult {
  const cached = envValidationCache.get(env)
  if (cached) return cached
  const result = parseEnv(env)
  envValidationCache.set(env, result)
  return result
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

const requireSameOrigin: MiddlewareHandler<AppContext> = async (c, next) => {
  if (c.req.method !== 'GET') {
    const origin = c.req.header('origin')
    if (!origin) return c.json({ error: 'origin required' }, 403)
    try {
      if (new URL(origin).origin !== new URL(c.req.url).origin) {
        return c.json({ error: 'origin mismatch' }, 403)
      }
    } catch {
      return c.json({ error: 'origin mismatch' }, 403)
    }
  }
  await next()
}

export function createAdminApp(
  storeFactory: (env: AdminEnv) => AdminStore = (env) =>
    createD1AdminStore(env.DB),
): Hono<AppContext> {
  const app = new Hono<AppContext>()

  const requireIdentity: MiddlewareHandler<AppContext> = async (c, next) => {
    const parsed = parseEnvironment(c.env)
    if (!parsed.ok) return c.json({ error: 'misconfigured' }, 503)
    const identity = await requireSession(
      c.req.raw,
      oauthConfig(parsed.config),
      c.env.DB,
      adminHooks(parsed.config.environment),
    )
    if (!identity) return c.json({ error: 'unauthorized' }, 401)
    c.set('identity', identity)
    c.set('store', storeFactory(c.env))
    await next()
  }

  app.get('/api/health', (c) =>
    c.json({
      status: 'ok',
      environment: c.env.ENVIRONMENT,
      version: c.env.DEPLOY_VERSION ?? null,
    }),
  )

  app.use('/api/admin/*', requireIdentity)
  app.use('/api/admin/*', requireSameOrigin)

  app.get('/api/admin/me', (c) => {
    const identity = c.get('identity')
    return c.json({
      provider: identity.provider,
      subject: identity.subject,
      environment: c.env.ENVIRONMENT,
    })
  })

  app.get(
    '/api/admin/players',
    queryValidator(searchQuerySchema),
    async (c) => {
      const query = c.req.valid('query')
      const players = await c.get('store').searchPlayers({
        playerId: query.playerId,
        name: query.name,
        ipHash: query.ipHash,
        limit: query.limit ?? 20,
      })
      return c.json({ players })
    },
  )

  app.get('/api/admin/players/:id', async (c) => {
    const id = c.req.param('id')
    const store = c.get('store')
    const player = await store.getPlayerDetail(id)
    if (!player) return c.json({ error: 'player not found' }, 404)
    const ipBan = player.ipHash ? await store.isIpBanned(player.ipHash) : null
    return c.json({ player, ipBan })
  })

  app.post(
    '/api/admin/players/:id/ban',
    jsonValidator(banSchema),
    async (c) => {
      const store = c.get('store')
      const identity = c.get('identity')
      const id = c.req.param('id')
      const { reason, until } = c.req.valid('json')
      const target = await store.getPlayerDetail(id)
      if (!target) return c.json({ error: 'player not found' }, 404)
      const untilIso = until ? new Date(until).toISOString() : null
      const changed = await store.banPlayer(id, untilIso)
      await store.recordAudit({
        actorProvider: identity.provider,
        actorSubject: identity.subject,
        action: 'player.ban',
        targetType: 'player',
        targetId: id,
        reason,
        beforeJson: JSON.stringify({
          banned: target.banned,
          bannedUntil: target.bannedUntil,
        }),
        afterJson: JSON.stringify({ banned: 1, bannedUntil: untilIso }),
        affectedCount: changed ? 1 : 0,
      })
      return c.json({ id, banned: 1, bannedUntil: untilIso, changed })
    },
  )

  app.post(
    '/api/admin/players/:id/unban',
    jsonValidator(reasonSchema),
    async (c) => {
      const store = c.get('store')
      const identity = c.get('identity')
      const id = c.req.param('id')
      const { reason } = c.req.valid('json')
      const target = await store.getPlayerDetail(id)
      if (!target) return c.json({ error: 'player not found' }, 404)
      const changed = await store.unbanPlayer(id)
      await store.recordAudit({
        actorProvider: identity.provider,
        actorSubject: identity.subject,
        action: 'player.unban',
        targetType: 'player',
        targetId: id,
        reason,
        beforeJson: JSON.stringify({
          banned: target.banned,
          bannedUntil: target.bannedUntil,
        }),
        afterJson: JSON.stringify({ banned: 0, bannedUntil: null }),
        affectedCount: changed ? 1 : 0,
      })
      return c.json({ id, banned: 0, changed })
    },
  )

  app.post(
    '/api/admin/players/:id/scores/hide',
    jsonValidator(scoreActionSchema),
    async (c) => {
      const store = c.get('store')
      const identity = c.get('identity')
      const id = c.req.param('id')
      const { reason, date } = c.req.valid('json')
      const target = await store.getPlayerDetail(id)
      if (!target) return c.json({ error: 'player not found' }, 404)
      const hidden = await store.hidePlayerScores(id, date ?? null)
      await store.recordAudit({
        actorProvider: identity.provider,
        actorSubject: identity.subject,
        action: 'scores.hide',
        targetType: 'player',
        targetId: id,
        reason,
        beforeJson: null,
        afterJson: JSON.stringify({ date: date ?? 'all', hidden: true }),
        affectedCount: hidden,
      })
      return c.json({ id, date: date ?? null, hidden })
    },
  )

  app.post(
    '/api/admin/players/:id/scores/unhide',
    jsonValidator(scoreActionSchema),
    async (c) => {
      const store = c.get('store')
      const identity = c.get('identity')
      const id = c.req.param('id')
      const { reason, date } = c.req.valid('json')
      const target = await store.getPlayerDetail(id)
      if (!target) return c.json({ error: 'player not found' }, 404)
      const restored = await store.unhidePlayerScores(id, date ?? null)
      await store.recordAudit({
        actorProvider: identity.provider,
        actorSubject: identity.subject,
        action: 'scores.unhide',
        targetType: 'player',
        targetId: id,
        reason,
        beforeJson: null,
        afterJson: JSON.stringify({ date: date ?? 'all', hidden: false }),
        affectedCount: restored,
      })
      return c.json({ id, date: date ?? null, restored })
    },
  )

  app.post('/api/admin/ip/:ipHash/ban', jsonValidator(banSchema), async (c) => {
    const store = c.get('store')
    const identity = c.get('identity')
    const ipHash = c.req.param('ipHash')
    const { reason, until } = c.req.valid('json')
    const untilIso = until ? new Date(until).toISOString() : null
    const knownAccounts = await store.countPlayersByIp(ipHash)
    const affected = await store.banIpHash(ipHash, {
      reason,
      bannedBy: identityLabel(identity),
      untilIso,
    })
    await store.recordAudit({
      actorProvider: identity.provider,
      actorSubject: identity.subject,
      action: 'ip.ban',
      targetType: 'ip',
      targetId: ipHash,
      reason,
      beforeJson: JSON.stringify({ knownAccounts }),
      afterJson: JSON.stringify({ banned: 1, bannedUntil: untilIso }),
      affectedCount: affected,
    })
    return c.json({
      ipHash,
      banned: 1,
      bannedUntil: untilIso,
      affected,
      knownAccounts,
    })
  })

  app.post(
    '/api/admin/ip/:ipHash/unban',
    jsonValidator(reasonSchema),
    async (c) => {
      const store = c.get('store')
      const identity = c.get('identity')
      const ipHash = c.req.param('ipHash')
      const { reason } = c.req.valid('json')
      const changed = await store.unbanIpHash(ipHash)
      await store.recordAudit({
        actorProvider: identity.provider,
        actorSubject: identity.subject,
        action: 'ip.unban',
        targetType: 'ip',
        targetId: ipHash,
        reason,
        beforeJson: null,
        afterJson: JSON.stringify({ banned: 0 }),
        affectedCount: changed ? 1 : 0,
      })
      return c.json({ ipHash, banned: 0, changed })
    },
  )

  app.get('/api/admin/banned-ips', async (c) => {
    const ips = await c.get('store').listBannedIps()
    return c.json({ ips })
  })

  app.get('/api/admin/audit', queryValidator(auditQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const logs = await c
      .get('store')
      .listAuditLogs(query.limit ?? 50, query.offset ?? 0)
    return c.json({ logs })
  })

  app.notFound((c) => c.json({ error: 'Not Found' }, 404))
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  return app
}

const adminApp = createAdminApp()
export default {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const parsed = parseEnvironment(env)
    if (!parsed.ok) {
      console.error(
        'invalid environment configuration:',
        parsed.issues.map((issue) => `${issue.path}: ${issue.message}`),
      )
      return new Response('service is misconfigured', { status: 503 })
    }
    const config = parsed.config
    const url = new URL(request.url)
    const oauth = oauthConfig(config)
    const hooks = adminHooks(config.environment)
    const routed = await handleAuthRoutes(request, oauth, env.DB, hooks)
    if (routed) return routed

    if (!url.pathname.startsWith('/api/')) {
      if (!(await requireSession(request, oauth, env.DB, hooks))) {
        return loginPageResponse(oauth)
      }
      if (!env.ASSETS) {
        return new Response('assets are not configured', { status: 500 })
      }
      const response = await env.ASSETS.fetch(request)
      const headers = new Headers(response.headers)
      headers.set('cache-control', 'private, no-store')
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    return adminApp.fetch(request, env)
  },
} satisfies ExportedHandler<AdminEnv>
