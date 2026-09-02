import assert from 'node:assert/strict'
import { test } from 'node:test'

import adminWorker, { createAdminApp } from '../src/worker/index.ts'
import type { AdminEnv } from '../src/worker/index.ts'
import {
  createAuthDb,
  createMemoryAdminStore,
  seedPlayer,
  sessionCookie,
  testAdminEnv,
} from './helpers.ts'

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json()
  return data as T
}

function createTest(
  options: {
    environment?: 'staging' | 'production'
    previewIdentities?: Array<{
      provider: string
      subject: string
      approvedAt?: string | null
      revokedAt?: string | null
    }>
    adminIdentities?: Array<{
      provider: string
      subject: string
      approvedAt?: string | null
      revokedAt?: string | null
    }>
  } = {},
) {
  const previewIdentities = options.previewIdentities ?? []
  const adminIdentities = options.adminIdentities ?? []
  const db = createAuthDb(
    previewIdentities,
    adminIdentities,
    [...previewIdentities, ...adminIdentities].map((identity) => ({
      id: `sid-${identity.subject}`,
      provider: identity.provider,
      subject: identity.subject,
    })),
  )
  const store = createMemoryAdminStore()
  const app = createAdminApp(() => store)
  const env = testAdminEnv({ environment: options.environment, db })
    .env as unknown as AdminEnv
  return { app, store, env }
}

function request(pathname: string, init: RequestInit = {}): Request {
  return new Request(`https://admin.example.com${pathname}`, init)
}

const APPROVED = '2026-09-01T00:00:00.000Z'

test('health endpoint is public', async () => {
  const { app, env } = createTest()
  const response = await app.fetch(request('/api/health'), env)
  assert.equal(response.status, 200)
  const body = await readJson<{ status: string; environment: string }>(response)
  assert.equal(body.status, 'ok')
  assert.equal(body.environment, 'staging')
})

test('admin assets require an approved session', async () => {
  const db = createAuthDb(
    [{ provider: 'github', subject: '1', approvedAt: APPROVED }],
    [],
    [{ id: 'sid-1', provider: 'github', subject: '1' }],
  )
  const env = testAdminEnv({ db }).env as unknown as AdminEnv
  env.ASSETS = {
    fetch: async () => new Response('admin asset'),
  } as unknown as Fetcher

  const unauthenticated = await adminWorker.fetch(
    request('/assets/index.js'),
    env,
  )
  assert.equal(unauthenticated.status, 200)
  assert.match(await unauthenticated.text(), /GitHub でログイン/)

  const authenticated = await adminWorker.fetch(
    request('/assets/index.js', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    env,
  )
  assert.equal(authenticated.status, 200)
  assert.equal(await authenticated.text(), 'admin asset')
  assert.equal(authenticated.headers.get('cache-control'), 'private, no-store')
})

test('admin api requires a session', async () => {
  const { app, env } = createTest()
  const response = await app.fetch(request('/api/admin/me'), env)
  assert.equal(response.status, 401)
})

test('staging session requires an approved preview identity', async () => {
  const { app, env } = createTest({
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
      { provider: 'github', subject: '2', approvedAt: null },
      {
        provider: 'github',
        subject: '3',
        approvedAt: APPROVED,
        revokedAt: APPROVED,
      },
    ],
  })
  const allowed = await app.fetch(
    request('/api/admin/me', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    env,
  )
  assert.equal(allowed.status, 200)

  const pending = await app.fetch(
    request('/api/admin/me', {
      headers: { cookie: await sessionCookie('sid-2') },
    }),
    env,
  )
  assert.equal(pending.status, 401)

  const revoked = await app.fetch(
    request('/api/admin/me', {
      headers: { cookie: await sessionCookie('sid-3') },
    }),
    env,
  )
  assert.equal(revoked.status, 401)
})

test('production requires an approved admin identity, not a preview approval', async () => {
  const previewOnly = createTest({
    environment: 'production',
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
    ],
  })
  const denied = await previewOnly.app.fetch(
    request('/api/admin/me', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    previewOnly.env,
  )
  assert.equal(denied.status, 401)

  const { app, env } = createTest({
    environment: 'production',
    adminIdentities: [
      { provider: 'github', subject: '9', approvedAt: APPROVED },
    ],
  })
  const allowed = await app.fetch(
    request('/api/admin/me', {
      headers: { cookie: await sessionCookie('sid-9') },
    }),
    env,
  )
  assert.equal(allowed.status, 200)
  const body = await readJson<{ environment: string }>(allowed)
  assert.equal(body.environment, 'production')
})

test('search players by name, id, and ip hash', async () => {
  const { app, store, env } = createTest({
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
    ],
  })
  seedPlayer(store, { id: 'player-alice', name: 'Alice', ipHash: 'ip-hash-a' })
  seedPlayer(store, { id: 'player-bob', name: 'Bob', ipHash: 'ip-hash-a' })
  seedPlayer(store, { id: 'player-carol', name: 'Carol', ipHash: 'ip-hash-c' })

  const byName = await app.fetch(
    request('/api/admin/players?name=Ali', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    env,
  )
  assert.equal(byName.status, 200)
  const byNameBody = await readJson<{ players: Array<{ id: string }> }>(byName)
  assert.deepEqual(
    byNameBody.players.map((player) => player.id),
    ['player-alice'],
  )

  const byIp = await app.fetch(
    request('/api/admin/players?ipHash=ip-hash-a', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    env,
  )
  const byIpBody = await readJson<{ players: Array<{ id: string }> }>(byIp)
  assert.equal(byIpBody.players.length, 2)

  const empty = await app.fetch(
    request('/api/admin/players', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    env,
  )
  assert.equal(empty.status, 400)
})

test('ban and unban a player with audit records', async () => {
  const { app, store, env } = createTest({
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
    ],
  })
  seedPlayer(store, { id: 'player-alice', name: 'Alice' })

  const missingReason = await app.fetch(
    request(`/api/admin/players/player-alice/ban`, {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://admin.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    }),
    env,
  )
  assert.equal(missingReason.status, 400)

  const ban = await app.fetch(
    request(`/api/admin/players/player-alice/ban`, {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://admin.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'fraud' }),
    }),
    env,
  )
  assert.equal(ban.status, 200)
  const banned = store.players.get('player-alice')
  assert.ok(banned)
  assert.equal(banned.banned, 1)
  assert.equal(banned.bannedUntil, null)

  const until = await app.fetch(
    request(`/api/admin/players/player-alice/unban`, {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://admin.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'mistake' }),
    }),
    env,
  )
  assert.equal(until.status, 200)
  const unbanned = store.players.get('player-alice')
  assert.equal(unbanned?.banned, 0)

  const audit = await app.fetch(
    request('/api/admin/audit', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    env,
  )
  const auditBody = await readJson<{
    logs: Array<{ action: string; reason: string }>
  }>(audit)
  assert.deepEqual(
    auditBody.logs.map((entry) => entry.action),
    ['player.unban', 'player.ban'],
  )
  assert.equal(auditBody.logs[0].reason, 'mistake')
  assert.equal(auditBody.logs[1].reason, 'fraud')
})

test('ban unknown player returns 404', async () => {
  const { app, env } = createTest({
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
    ],
  })
  const response = await app.fetch(
    request('/api/admin/players/unknown-player/ban', {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://admin.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'fraud' }),
    }),
    env,
  )
  assert.equal(response.status, 404)
})

test('mutations require a same-origin header', async () => {
  const { app, store, env } = createTest({
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
    ],
  })
  seedPlayer(store, { id: 'player-alice', name: 'Alice' })

  const noOrigin = await app.fetch(
    request('/api/admin/players/player-alice/ban', {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'fraud' }),
    }),
    env,
  )
  assert.equal(noOrigin.status, 403)

  const crossOrigin = await app.fetch(
    request('/api/admin/players/player-alice/ban', {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://evil.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'fraud' }),
    }),
    env,
  )
  assert.equal(crossOrigin.status, 403)
  assert.equal(store.players.get('player-alice')?.banned, 0)
})

test('banning an ip bans existing accounts and blocks future registrations', async () => {
  const { app, store, env } = createTest({
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
    ],
  })
  seedPlayer(store, { id: 'player-alice', name: 'Alice', ipHash: 'ip-hash-a' })
  seedPlayer(store, { id: 'player-bob', name: 'Bob', ipHash: 'ip-hash-a' })

  const ban = await app.fetch(
    request('/api/admin/ip/ip-hash-a/ban', {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://admin.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'shared fraud network' }),
    }),
    env,
  )
  assert.equal(ban.status, 200)
  const body = await readJson<{ affected: number }>(ban)
  assert.equal(body.affected, 2)
  assert.equal(store.ipBans.get('ip-hash-a')?.reason, 'shared fraud network')
  assert.equal(store.players.get('player-alice')?.banned, 1)

  const list = await app.fetch(
    request('/api/admin/banned-ips', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    env,
  )
  const listBody = await readJson<{ ips: Array<{ ipHash: string }> }>(list)
  assert.deepEqual(
    listBody.ips.map((row) => row.ipHash),
    ['ip-hash-a'],
  )
})

test('unbanning an ip removes the future block but keeps account bans', async () => {
  const { app, store, env } = createTest({
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
    ],
  })
  seedPlayer(store, { id: 'player-alice', name: 'Alice', ipHash: 'ip-hash-a' })
  await store.banIpHash('ip-a', {
    reason: 'fraud',
    bannedBy: 'github:1',
    untilIso: null,
  })
  await store.banPlayer('player-alice', null)

  const response = await app.fetch(
    request('/api/admin/ip/ip-hash-a/unban', {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://admin.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'false positive' }),
    }),
    env,
  )
  assert.equal(response.status, 200)
  assert.equal(store.ipBans.has('ip-hash-a'), false)
  assert.equal(store.players.get('player-alice')?.banned, 1)
})

test('hide and unhide player scores', async () => {
  const { app, store, env } = createTest({
    previewIdentities: [
      { provider: 'github', subject: '1', approvedAt: APPROVED },
    ],
  })
  seedPlayer(store, {
    id: 'player-alice',
    name: 'Alice',
    scores: [
      {
        dateKey: '2026-09-01',
        score: 100,
        combo: 2,
        createdAt: '2026-09-01T12:00:00.000Z',
        hiddenAt: null,
      },
      {
        dateKey: '2026-08-31',
        score: 90,
        combo: 1,
        createdAt: '2026-08-31T12:00:00.000Z',
        hiddenAt: null,
      },
    ],
  })

  const hide = await app.fetch(
    request('/api/admin/players/player-alice/scores/hide', {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://admin.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'impossible score', date: '2026-09-01' }),
    }),
    env,
  )
  assert.equal(hide.status, 200)
  const hideBody = await readJson<{ hidden: number }>(hide)
  assert.equal(hideBody.hidden, 1)
  assert.notEqual(
    store.players
      .get('player-alice')
      ?.scores.find((score) => score.dateKey === '2026-09-01')?.hiddenAt,
    null,
  )

  const detail = await app.fetch(
    request('/api/admin/players/player-alice', {
      headers: { cookie: await sessionCookie('sid-1') },
    }),
    env,
  )
  const detailBody = await readJson<{
    player: { scores: Array<{ dateKey: string; hiddenAt: string | null }> }
  }>(detail)
  assert.equal(
    detailBody.player.scores.find((score) => score.dateKey === '2026-09-01')
      ?.hiddenAt !== null,
    true,
  )

  const unhide = await app.fetch(
    request('/api/admin/players/player-alice/scores/unhide', {
      method: 'POST',
      headers: {
        cookie: await sessionCookie('sid-1'),
        origin: 'https://admin.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'appeal accepted' }),
    }),
    env,
  )
  assert.equal(unhide.status, 200)
  const unhideBody = await readJson<{ restored: number }>(unhide)
  assert.equal(unhideBody.restored, 1)
  assert.equal(
    store.players
      .get('player-alice')
      ?.scores.every((score) => score.hiddenAt === null),
    true,
  )
})
