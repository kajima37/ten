import assert from 'node:assert/strict'
import test from 'node:test'

import { addDays, getJstWeekStartDateKey } from '../src/daily.ts'
import { createTestContext, jsonInit, readJson, register } from './helpers.ts'

function auth(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  return { ...init, headers }
}

test('friend code requests require approval before weekly friend comparison', async () => {
  const { app, env, store } = createTestContext()
  const alice = await register(app, env, 'device-alice', { name: 'Alice' })
  const bob = await register(app, env, 'device-bob', { name: 'Bob' })
  const bobProfile = await app.request(
    'https://example.com/api/me',
    auth(bob.token),
    env,
  )
  const { friendCode } = await readJson<{ friendCode: string }>(bobProfile)

  const request = await app.request(
    'https://example.com/api/friend-requests',
    auth(
      alice.token,
      jsonInit({ method: 'POST', body: JSON.stringify({ friendCode }) }),
    ),
    env,
  )
  assert.equal(request.status, 201)

  const pending = await app.request(
    'https://example.com/api/friends',
    auth(bob.token),
    env,
  )
  const pendingBody = await readJson<{
    friends: Array<unknown>
    requests: Array<{ id: number; playerId: string; direction: string }>
  }>(pending)
  assert.equal(pendingBody.friends.length, 0)
  assert.equal(pendingBody.requests[0].playerId, alice.playerId)
  assert.equal(pendingBody.requests[0].direction, 'incoming')

  const accepted = await app.request(
    `https://example.com/api/friend-requests/${pendingBody.requests[0].id}/accept`,
    auth(bob.token, { method: 'POST' }),
    env,
  )
  assert.equal(accepted.status, 200)

  const week = getJstWeekStartDateKey()
  await store.upsertDailyScore(alice.playerId, week, 500, 3)
  await store.upsertDailyScore(bob.playerId, week, 800, 4)
  const leaderboard = await app.request(
    `https://example.com/api/leaderboard/weekly?week=${week}&scope=friends`,
    auth(alice.token),
    env,
  )
  const body = await readJson<{
    week: string
    entries: Array<{ playerId: string; rank: number; score: number }>
  }>(leaderboard)
  assert.equal(body.week, week)
  assert.deepEqual(
    body.entries.map((entry) => entry.playerId),
    [bob.playerId, alice.playerId],
  )
  assert.deepEqual(
    body.entries.map((entry) => entry.rank),
    [1, 2],
  )
})

test('weekly leaderboard sums each daily best and exposes a streak', async () => {
  const { app, env, store } = createTestContext()
  const alice = await register(app, env, 'device-alice')
  const bob = await register(app, env, 'device-bob')
  const week = getJstWeekStartDateKey()
  await store.upsertDailyScore(alice.playerId, week, 500, 2)
  await store.upsertDailyScore(alice.playerId, addDays(week, 1), 900, 6)
  await store.upsertDailyScore(bob.playerId, week, 1_000, 4)

  const response = await app.request(
    `https://example.com/api/leaderboard/weekly?week=${week}`,
    auth(alice.token),
    env,
  )
  assert.equal(response.status, 200)
  const body = await readJson<{
    entries: Array<{ playerId: string; score: number; streak: number }>
  }>(response)
  const entry = body.entries.find((item) => item.playerId === alice.playerId)
  assert.ok(entry)
  assert.equal(entry.score, 1_400)
  assert.equal(entry.streak, 2)
})

test('friend code can be rotated and old codes no longer resolve', async () => {
  const { app, env } = createTestContext()
  const alice = await register(app, env, 'device-alice')
  const profile = await app.request(
    'https://example.com/api/me',
    auth(alice.token),
    env,
  )
  const oldCode = (await readJson<{ friendCode: string }>(profile)).friendCode
  const rotate = await app.request(
    'https://example.com/api/me/friend-code',
    auth(alice.token, { method: 'POST' }),
    env,
  )
  const { code } = await readJson<{ code: string }>(rotate)
  assert.notEqual(code, oldCode)
})
