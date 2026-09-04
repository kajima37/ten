import assert from 'node:assert/strict'
import test from 'node:test'

import { getJstDateKey, getDailySeed } from '../src/daily.ts'
import {
  computeOutcome,
  createTestContext,
  jsonInit,
  readJson,
  register,
  simulateDailyGame,
  startDaily,
} from './helpers.ts'

function submitScoreInit(token: string, body: unknown): RequestInit {
  return jsonInit({
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

test('health endpoint responds ok', async () => {
  const { app, env } = createTestContext()
  const response = await app.request('https://example.com/api/health', {}, env)
  assert.equal(response.status, 200)
  assert.deepEqual(await readJson(response), { status: 'ok', version: null })
})

test('unknown routes return 404', async () => {
  const { app, env } = createTestContext()
  const response = await app.request('https://example.com/', {}, env)
  assert.equal(response.status, 404)
})

test('register issues a token with a server-issued player id', async () => {
  const { app, env } = createTestContext()
  const { body } = await register(app, env, 'device-alpha', { name: 'Alice' })
  assert.ok(body.token.length > 10)
  assert.notEqual(body.player.id, 'device-alpha')
  assert.equal(body.player.name, 'Alice')
})

test('register deduplicates by device id', async () => {
  const { app, env } = createTestContext()
  const first = await register(app, env, 'device-alpha', { name: 'Alice' })
  const second = await register(app, env, 'device-alpha', { name: 'Bob' })
  assert.equal(first.body.player.id, second.body.player.id)
  assert.equal(first.body.token !== second.body.token, true)
})

test('register rejects invalid device ids', async () => {
  const { app, env } = createTestContext()
  const response = await app.request(
    'https://example.com/api/auth/register',
    jsonInit({ method: 'POST', body: JSON.stringify({ deviceId: '' }) }),
    env,
  )
  assert.equal(response.status, 400)
})

test('daily returns a deterministic board and caches it', async () => {
  const { app, env } = createTestContext()
  const first = await app.request('https://example.com/api/daily', {}, env)
  const firstBody = await readJson<{ dateKey: string; board: Array<number> }>(
    first,
  )
  assert.equal(firstBody.dateKey, getJstDateKey())
  assert.equal(firstBody.board.length, 25)

  const second = await app.request('https://example.com/api/daily', {}, env)
  const secondBody = await readJson<{ board: Array<number> }>(second)
  assert.deepEqual(secondBody.board, firstBody.board)
})

test('daily start requires authentication and issues a player-bound token', async () => {
  const { app, env } = createTestContext()
  const unauthorized = await app.request(
    'https://example.com/api/daily/start',
    { method: 'POST' },
    env,
  )
  assert.equal(unauthorized.status, 401)

  const { body: registered } = await register(app, env, 'device-alpha')
  const started = await startDaily(app, env, registered.token)
  assert.equal(started.response.status, 200)
  assert.equal(started.body.dateKey, getJstDateKey())
  assert.ok(started.body.startToken.length > 20)
})

test('daily score rejects a start token from another player', async () => {
  const { app, env } = createTestContext()
  const first = await register(app, env, 'device-alpha')
  const second = await register(app, env, 'device-bravo')
  const started = await startDaily(app, env, first.token)
  const events = simulateDailyGame(getDailySeed(started.body.dateKey), 1)
  const { score, maxCombo } = computeOutcome(events)
  const response = await app.request(
    'https://example.com/api/scores',
    submitScoreInit(second.token, {
      mode: 'daily',
      dateKey: started.body.dateKey,
      startToken: started.body.startToken,
      events,
      score,
      maxCombo,
    }),
    env,
  )
  assert.equal(response.status, 400)
})

test('daily score submission is verified and ranked', async () => {
  const { app, env } = createTestContext()
  const { body: registerBody } = await register(app, env, 'device-alpha', {
    name: 'Alice',
  })

  const dateKey = getJstDateKey()
  const start = await startDaily(app, env, registerBody.token)
  const seed = getDailySeed(dateKey)
  const events = simulateDailyGame(seed, 8)
  const { score, maxCombo } = computeOutcome(events)

  const response = await app.request(
    'https://example.com/api/scores',
    submitScoreInit(registerBody.token, {
      mode: 'daily',
      dateKey,
      startToken: start.body.startToken,
      events,
      score,
      maxCombo,
    }),
    env,
  )
  assert.equal(response.status, 200)
  const body = await readJson<{
    accepted: boolean
    isNewBest: boolean
    best: number
    rank: number
  }>(response)
  assert.equal(body.accepted, true)
  assert.equal(body.isNewBest, true)
  assert.equal(body.best, score)
  assert.equal(body.rank, 1)

  const leaderboard = await app.request(
    `https://example.com/api/leaderboard?date=${dateKey}`,
    { headers: { authorization: `Bearer ${registerBody.token}` } },
    env,
  )
  const leaderboardBody = await readJson<{
    total: number
    entries: Array<{ playerId: string; rank: number; score: number }>
    mine: { rank: number; topPercent: number; score: number }
  }>(leaderboard)
  assert.equal(leaderboardBody.total, 1)
  assert.equal(leaderboardBody.entries[0].playerId, registerBody.player.id)
  assert.equal(leaderboardBody.entries[0].score, score)
  assert.equal(leaderboardBody.mine.rank, 1)
})

test('score submission requires authentication', async () => {
  const { app, env } = createTestContext()
  const response = await app.request(
    'https://example.com/api/scores',
    jsonInit({ method: 'POST', body: JSON.stringify({}) }),
    env,
  )
  assert.equal(response.status, 401)
})

test('tampered score is rejected by verification', async () => {
  const { app, env } = createTestContext()
  const { body: registerBody } = await register(app, env, 'device-alpha')

  const dateKey = getJstDateKey()
  const start = await startDaily(app, env, registerBody.token)
  const seed = getDailySeed(dateKey)
  const events = simulateDailyGame(seed, 5)

  const response = await app.request(
    'https://example.com/api/scores',
    submitScoreInit(registerBody.token, {
      mode: 'daily',
      dateKey,
      startToken: start.body.startToken,
      events,
      score: 999999,
      maxCombo: 999,
    }),
    env,
  )
  assert.equal(response.status, 400)
  const body = await readJson<{ error: string }>(response)
  assert.equal(body.error, 'verification failed')
})

test('validation rejects malformed submissions', async () => {
  const { app, env } = createTestContext()
  const { body: registerBody } = await register(app, env, 'device-alpha')

  const response = await app.request(
    'https://example.com/api/scores',
    submitScoreInit(registerBody.token, {
      mode: 'daily',
      dateKey: 'not-a-date',
      events: [{ type: 'eliminate', cells: [0, 1] }],
      score: 1.5,
      maxCombo: -1,
    }),
    env,
  )
  assert.equal(response.status, 400)
})

test('profile name can be updated', async () => {
  const { app, env } = createTestContext()
  const { body: registerBody } = await register(app, env, 'device-alpha', {
    name: 'Alice',
  })

  const update = await app.request(
    'https://example.com/api/me',
    jsonInit({
      method: 'PATCH',
      headers: { authorization: `Bearer ${registerBody.token}` },
      body: JSON.stringify({ name: 'Bob' }),
    }),
    env,
  )
  assert.equal(update.status, 200)
  assert.deepEqual(await readJson(update), {
    id: registerBody.player.id,
    name: 'Bob',
  })
})

test('account deletion removes the player and related data', async () => {
  const { app, env, store } = createTestContext()
  const { body: registerBody } = await register(app, env, 'device-alpha')
  const playerId = registerBody.player.id
  store.scores.push({
    playerId,
    mode: 'daily',
    dateKey: '2026-09-04',
    score: 10,
    combo: 1,
    createdAt: new Date().toISOString(),
    hiddenAt: null,
  })
  store.proofs.push({
    playerId,
    dateKey: '2026-09-04',
    score: 10,
    events: '[]',
  })
  store.logs.push(`${playerId}:2026-09-04T00:00:00.000Z`)
  store.friendCodes.set(playerId, { code: 'TEN-ABCD', expiresAt: '2099-01-01' })

  const response = await app.request(
    'https://example.com/api/me',
    jsonInit({
      method: 'DELETE',
      headers: { authorization: `Bearer ${registerBody.token}` },
    }),
    env,
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await readJson(response), { deleted: true })
  assert.equal(store.players.has(playerId), false)
  assert.equal(
    store.scores.some((entry) => entry.playerId === playerId),
    false,
  )
  assert.equal(
    store.proofs.some((entry) => entry.playerId === playerId),
    false,
  )
  assert.equal(
    store.logs.some((entry) => entry.startsWith(`${playerId}:`)),
    false,
  )
  assert.equal(store.friendCodes.has(playerId), false)
})

test('external deletion link deletes an account with a generated code', async () => {
  const { app, env, store } = createTestContext()
  const { body: registerBody } = await register(app, env, 'device-alpha')
  const codeResponse = await app.request(
    'https://example.com/api/me/deletion-code',
    jsonInit({
      headers: { authorization: `Bearer ${registerBody.token}` },
    }),
    env,
  )
  assert.equal(codeResponse.status, 200)
  const { deletionCode } = await readJson<{ deletionCode: string }>(
    codeResponse,
  )
  const page = await app.request(
    `https://example.com/account-deletion?code=${encodeURIComponent(deletionCode)}`,
    undefined,
    env,
  )
  assert.equal(page.status, 200)
  assert.match(await page.text(), /アカウント削除/)

  const englishTerms = await app.request(
    'https://example.com/terms?lang=en',
    undefined,
    env,
  )
  assert.equal(englishTerms.status, 200)
  assert.match(await englishTerms.text(), /Terms of service/)

  const deletion = await app.request(
    'https://example.com/api/account/delete',
    jsonInit({
      method: 'POST',
      body: JSON.stringify({ deletionCode }),
    }),
    env,
  )
  assert.equal(deletion.status, 200)
  assert.equal(store.players.has(registerBody.player.id), false)
})

test('repeated submissions are rate limited', async () => {
  const { app, env } = createTestContext()
  const { body: registerBody } = await register(app, env, 'device-alpha')

  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)
  const start = await startDaily(app, env, registerBody.token)

  let lastStatus = 0
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const events = simulateDailyGame(seed, 3)
    const { score, maxCombo } = computeOutcome(events)
    const response = await app.request(
      'https://example.com/api/scores',
      submitScoreInit(registerBody.token, {
        mode: 'daily',
        dateKey,
        startToken: start.body.startToken,
        events,
        score,
        maxCombo,
      }),
      env,
    )
    lastStatus = response.status
  }
  assert.equal(lastStatus, 429)
})

test('preflight request does not allow the retired GitHub Pages origin', async () => {
  const { app, env } = createTestContext()
  const response = await app.request(
    'https://example.com/api/scores',
    {
      method: 'OPTIONS',
      headers: { origin: 'https://kajima37.github.io' },
    },
    env,
  )
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('capacitor origins are allowed for mobile clients', async () => {
  const { app, env } = createTestContext()
  for (const origin of [
    'https://localhost',
    'capacitor://localhost',
    'http://localhost',
  ]) {
    const response = await app.request(
      'https://example.com/api/health',
      {
        headers: { origin },
      },
      env,
    )
    assert.equal(response.headers.get('access-control-allow-origin'), origin)
  }
})

test('submissions store a verifiable proof', async () => {
  const { app, env, store } = createTestContext()
  const { body: registerBody } = await register(app, env, 'device-alpha')

  const dateKey = getJstDateKey()
  const seed = getDailySeed(dateKey)
  const start = await startDaily(app, env, registerBody.token)
  const events = simulateDailyGame(seed, 4)
  const { score, maxCombo } = computeOutcome(events)

  await app.request(
    'https://example.com/api/scores',
    submitScoreInit(registerBody.token, {
      mode: 'daily',
      dateKey,
      startToken: start.body.startToken,
      events,
      score,
      maxCombo,
    }),
    env,
  )

  assert.equal(store.proofs.length, 1)
  assert.equal(store.proofs[0].playerId, registerBody.player.id)
  assert.equal(store.proofs[0].score, score)
  assert.deepEqual(JSON.parse(store.proofs[0].events), events)
})
