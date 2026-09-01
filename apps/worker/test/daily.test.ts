import assert from 'node:assert/strict'
import test from 'node:test'

import { getJstDateKey, getDailySeed, getDailyBoard } from '../src/daily.ts'

test('JST date key shifts UTC time across the 15:00 boundary', () => {
  assert.equal(getJstDateKey(new Date('2026-09-01T14:59:00Z')), '2026-09-01')
  assert.equal(getJstDateKey(new Date('2026-09-01T15:00:00Z')), '2026-09-02')
  assert.equal(getJstDateKey(new Date('2026-12-31T14:59:00Z')), '2026-12-31')
  assert.equal(getJstDateKey(new Date('2026-12-31T15:00:00Z')), '2027-01-01')
})

test('daily seed is derived from the date key', () => {
  assert.equal(getDailySeed('2026-09-01'), 20260901)
  assert.equal(getDailySeed('2027-01-01'), 20270101)
})

test('daily board is deterministic per date key', () => {
  assert.deepEqual(getDailyBoard('2026-09-01'), getDailyBoard('2026-09-01'))
  assert.notDeepEqual(getDailyBoard('2026-09-01'), getDailyBoard('2026-09-02'))
})
