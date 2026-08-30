import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PLAYER_STATE_VERSION,
  initialPlayerState,
  migratePlayerState,
} from '../src/lib/player-state.ts'

test('invalid state safely falls back to the initial state', () => {
  assert.deepEqual(migratePlayerState(null, '2026-08-31'), initialPlayerState)
})

test('legacy state is migrated and its daily best is preserved', () => {
  const migrated = migratePlayerState(
    {
      best: 1200,
      plays: 3,
      total: 2500,
      dailyBest: 900,
      streak: 2,
    },
    '2026-08-31',
  )

  assert.equal(migrated.version, PLAYER_STATE_VERSION)
  assert.equal(migrated.best, 1200)
  assert.deepEqual(migrated.dailyRecords['2026-08-31'], {
    best: 900,
    plays: 1,
  })
})

test('corrupt and negative values are sanitized', () => {
  const migrated = migratePlayerState(
    {
      best: -1,
      plays: 'many',
      total: Number.NaN,
      streak: -4,
      dailyRecords: {
        invalid: { best: 10, plays: 1 },
        '2026-08-31': { best: 700, plays: 2 },
      },
    },
    '2026-08-31',
  )

  assert.equal(migrated.best, 0)
  assert.equal(migrated.plays, 0)
  assert.equal(migrated.total, 0)
  assert.equal(migrated.streak, 0)
  assert.deepEqual(Object.keys(migrated.dailyRecords), ['2026-08-31'])
})
