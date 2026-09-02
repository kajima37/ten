import assert from 'node:assert/strict'
import test from 'node:test'

import { hashIp } from '../src/auth.ts'
import { getJstDateKey, getDailySeed } from '../src/daily.ts'
import {
  createTestContext,
  readJson,
  register,
  startDaily,
  submitDaily,
} from './helpers.ts'

function banPlayerDirect(
  context: ReturnType<typeof createTestContext>,
  playerId: string,
  untilIso: string | null,
) {
  const player = context.store.players.get(playerId)
  assert.ok(player)
  context.store.players.set(playerId, {
    ...player,
    banned: 1,
    bannedUntil: untilIso,
  })
}

test('registration and submissions are blocked for a banned ip', async () => {
  const { app, env, store } = createTestContext()
  const ip = '203.0.113.5'
  const ipHash = await hashIp(ip, env.AUTH_SECRET)
  const alice = await register(app, env, 'device-a', { ip, name: 'Alice' })

  store.bannedIps.set(ipHash, {
    ipHash,
    reason: 'fraud network',
    bannedBy: 'admin',
    expiresAt: null,
    createdAt: new Date().toISOString(),
  })

  const blocked = await app.request(
    'https://example.com/api/auth/register',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': ip,
      },
      body: JSON.stringify({ deviceId: 'device-new', name: 'Mallory' }),
    },
    env,
  )
  assert.equal(blocked.status, 403)

  const start = await startDaily(app, env, alice.token, { ip })
  assert.equal(start.response.status, 403)
})

test('an expired ip ban no longer blocks registration', async () => {
  const { app, env, store } = createTestContext()
  const ip = '203.0.113.7'
  const ipHash = await hashIp(ip, env.AUTH_SECRET)
  store.bannedIps.set(ipHash, {
    ipHash,
    reason: 'temporary',
    bannedBy: 'admin',
    expiresAt: '2020-01-01T00:00:00.000Z',
    createdAt: '2020-01-01T00:00:00.000Z',
  })
  const response = await register(app, env, 'device-after', {
    ip,
    name: 'Bob',
  })
  assert.equal(response.response.status, 200)
})

test('a timed player ban expires and restores access', async () => {
  const { app, env, store } = createTestContext()
  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)
  const alice = await register(app, env, 'device-a', { name: 'Alice' })

  banPlayerDirect(
    { app, env, store },
    alice.playerId,
    '2020-01-01T00:00:00.000Z',
  )
  const active = store.players.get(alice.playerId)
  assert.ok(active)
  store.players.set(alice.playerId, {
    ...active,
    banned: 1,
    bannedUntil: new Date(Date.now() + 60_000).toISOString(),
  })
  const duringBan = await startDaily(app, env, alice.token)
  assert.equal(duringBan.response.status, 403)

  const banned = store.players.get(alice.playerId)
  assert.ok(banned)
  store.players.set(alice.playerId, {
    ...banned,
    bannedUntil: new Date(Date.now() - 60_000).toISOString(),
  })
  const afterExpiry = await submitDaily(app, env, alice.token, dateKey, seed, 3)
  assert.equal(afterExpiry.response.status, 200)
})

test('hidden scores are excluded from daily and weekly leaderboards', async () => {
  const { app, env, store } = createTestContext()
  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)

  const alice = await register(app, env, 'device-a', { name: 'Alice' })
  const bob = await register(app, env, 'device-b', { name: 'Bob' })
  await submitDaily(app, env, alice.token, dateKey, seed, 6)
  await submitDaily(app, env, bob.token, dateKey, seed, 3)

  const aliceEntry = store.scores.find(
    (entry) => entry.playerId === alice.playerId,
  )
  assert.ok(aliceEntry)
  aliceEntry.hiddenAt = new Date().toISOString()

  const leaderboard = await app.request(
    `https://example.com/api/leaderboard?date=${dateKey}`,
    {},
    env,
  )
  const body = await readJson<{
    total: number
    entries: Array<{ playerId: string }>
  }>(leaderboard)
  assert.equal(body.total, 1)
  assert.deepEqual(
    body.entries.map((entry) => entry.playerId),
    [bob.playerId],
  )

  const mine = await app.request(
    `https://example.com/api/leaderboard?date=${dateKey}`,
    { headers: { authorization: `Bearer ${alice.token}` } },
    env,
  )
  const mineBody = await readJson<{ mine: unknown }>(mine)
  assert.equal(mineBody.mine, null)
})

test('unban restores the player', async () => {
  const { app, env, store } = createTestContext()
  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)
  const alice = await register(app, env, 'device-a', { name: 'Alice' })

  banPlayerDirect({ app, env, store }, alice.playerId, null)
  const banned = await startDaily(app, env, alice.token)
  assert.equal(banned.response.status, 403)

  const player = store.players.get(alice.playerId)
  assert.ok(player)
  store.players.set(alice.playerId, { ...player, banned: 0, bannedUntil: null })

  const restored = await submitDaily(app, env, alice.token, dateKey, seed, 3)
  assert.equal(restored.response.status, 200)
})
