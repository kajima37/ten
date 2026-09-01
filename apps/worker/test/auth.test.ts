import assert from 'node:assert/strict'
import test from 'node:test'

import {
  signDailyStartToken,
  signToken,
  verifyDailyStartToken,
  verifyToken,
} from '../src/auth.ts'

const SECRET = 'test-secret'

test('sign and verify round-trips the player id', async () => {
  const token = await signToken('player-1', SECRET)
  assert.equal(await verifyToken(token, SECRET), 'player-1')
})

test('expired token is rejected', async () => {
  const now = Date.now()
  const token = await signToken('player-1', SECRET, now)
  const later = now + 1000 * 60 * 60 * 24 * 31
  assert.equal(await verifyToken(token, SECRET, later), null)
})

test('tampered token is rejected', async () => {
  const token = await signToken('player-1', SECRET)
  const tampered = `${token.slice(0, -1)}x`
  assert.equal(await verifyToken(tampered, SECRET), null)
})

test('wrong secret is rejected', async () => {
  const token = await signToken('player-1', SECRET)
  assert.equal(await verifyToken(token, 'other-secret'), null)
})

test('daily start token is player and date bound and expires', async () => {
  const now = 1_000_000
  const token = await signDailyStartToken(
    'player-1',
    '2026-09-02',
    SECRET,
    now + 1_000,
  )
  assert.deepEqual(await verifyDailyStartToken(token, SECRET, now), {
    playerId: 'player-1',
    dateKey: '2026-09-02',
    expiresAt: now + 1_000,
  })
  assert.equal(await verifyDailyStartToken(token, SECRET, now + 1_001), null)
})
