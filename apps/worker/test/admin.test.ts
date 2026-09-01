import assert from 'node:assert/strict'
import test from 'node:test'

import { hashIp } from '../src/auth.ts'
import { getJstDateKey, getDailySeed } from '../src/daily.ts'
import {
  createTestContext,
  readJson,
  register,
  submitDaily,
} from './helpers.ts'

test('admin endpoints require the admin secret', async () => {
  const { app, env } = createTestContext()
  const response = await app.request(
    'https://example.com/api/admin/players?ipHash=abc',
    {},
    env,
  )
  assert.equal(response.status, 403)

  const withToken = await app.request(
    'https://example.com/api/admin/players?ipHash=abc',
    { headers: { authorization: 'Bearer admin-secret' } },
    env,
  )
  assert.equal(withToken.status, 200)
})

test('players can be found by their hashed ip', async () => {
  const { app, env } = createTestContext()
  const ip = '203.0.113.5'
  const { playerId } = await register(app, env, 'device-1', {
    ip,
    name: 'Alice',
  })
  const ipHash = await hashIp(ip, env.AUTH_SECRET)

  const response = await app.request(
    `https://example.com/api/admin/players?ipHash=${ipHash}`,
    { headers: { authorization: 'Bearer admin-secret' } },
    env,
  )
  assert.equal(response.status, 200)
  const body = await readJson<{ players: Array<{ id: string; name: string }> }>(
    response,
  )
  assert.equal(body.players.length, 1)
  assert.equal(body.players[0].id, playerId)
})

test('banned players are excluded from the leaderboard and cannot submit', async () => {
  const { app, env } = createTestContext()
  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)

  const alice = await register(app, env, 'device-a', {
    ip: '203.0.113.5',
    name: 'Alice',
  })
  const bob = await register(app, env, 'device-b', {
    ip: '203.0.113.6',
    name: 'Bob',
  })
  await submitDaily(app, env, alice.token, dateKey, seed, 6)
  await submitDaily(app, env, bob.token, dateKey, seed, 3)

  const ban = await app.request(
    `https://example.com/api/admin/players/${alice.playerId}/ban`,
    { method: 'POST', headers: { authorization: 'Bearer admin-secret' } },
    env,
  )
  assert.equal(ban.status, 200)

  const leaderboard = await app.request(
    `https://example.com/api/leaderboard?date=${dateKey}`,
    {},
    env,
  )
  const leaderboardBody = await readJson<{
    total: number
    entries: Array<{ playerId: string }>
  }>(leaderboard)
  assert.equal(leaderboardBody.total, 1)
  assert.equal(leaderboardBody.entries[0].playerId, bob.playerId)

  const submit = await submitDaily(app, env, alice.token, dateKey, seed, 4)
  assert.equal(submit.response.status, 403)
})

test('unban restores the player', async () => {
  const { app, env } = createTestContext()
  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)
  const alice = await register(app, env, 'device-a', {
    ip: '203.0.113.5',
    name: 'Alice',
  })

  await app.request(
    `https://example.com/api/admin/players/${alice.playerId}/ban`,
    { method: 'POST', headers: { authorization: 'Bearer admin-secret' } },
    env,
  )
  await app.request(
    `https://example.com/api/admin/players/${alice.playerId}/unban`,
    { method: 'POST', headers: { authorization: 'Bearer admin-secret' } },
    env,
  )
  const submit = await submitDaily(app, env, alice.token, dateKey, seed, 3)
  assert.equal(submit.response.status, 200)
})

test('banning an ip bans every account behind it', async () => {
  const { app, env } = createTestContext()
  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)
  const ip = '203.0.113.9'
  const ipHash = await hashIp(ip, env.AUTH_SECRET)

  const first = await register(app, env, 'device-1', { ip, name: 'Alice' })
  const second = await register(app, env, 'device-2', { ip, name: 'Bob' })

  const ban = await app.request(
    `https://example.com/api/admin/ip/${ipHash}/ban`,
    { method: 'POST', headers: { authorization: 'Bearer admin-secret' } },
    env,
  )
  assert.equal(ban.status, 200)

  const a = await submitDaily(app, env, first.token, dateKey, seed, 3)
  const b = await submitDaily(app, env, second.token, dateKey, seed, 3)
  assert.equal(a.response.status, 403)
  assert.equal(b.response.status, 403)
})

test('fraudulent scores can be deleted', async () => {
  const { app, env, store } = createTestContext()
  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)
  const alice = await register(app, env, 'device-a', {
    ip: '203.0.113.5',
    name: 'Alice',
  })
  const { score } = await submitDaily(app, env, alice.token, dateKey, seed, 6)

  const del = await app.request(
    `https://example.com/api/admin/players/${alice.playerId}/scores?date=${dateKey}`,
    { method: 'DELETE', headers: { authorization: 'Bearer admin-secret' } },
    env,
  )
  assert.equal(del.status, 200)

  const leaderboard = await app.request(
    `https://example.com/api/leaderboard?date=${dateKey}`,
    {},
    env,
  )
  const leaderboardBody = await readJson<{ total: number }>(leaderboard)
  assert.equal(leaderboardBody.total, 0)
  assert.equal(store.proofs.filter((p) => p.score === score).length, 0)
})

test('registration is rate limited per ip', async () => {
  const { app, env } = createTestContext()
  const ip = '203.0.113.42'
  let lastStatus = 0
  for (let index = 0; index < 21; index += 1) {
    const response = await app.request(
      'https://example.com/api/auth/register',
      {
        method: 'POST',
        headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: `device-${index}-${'x'.repeat(10)}` }),
      },
      env,
    )
    lastStatus = response.status
  }
  assert.equal(lastStatus, 429)
})
