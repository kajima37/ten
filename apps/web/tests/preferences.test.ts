import assert from 'node:assert/strict'
import test from 'node:test'

import {
  initialPreferences,
  normalizePreferences,
} from '../src/lib/preferences.ts'

test('legacy preferences receive sound defaults', () => {
  assert.deepEqual(normalizePreferences({ vibration: false }), {
    ...initialPreferences,
    vibration: false,
  })
})

test('sound volume is clamped to the supported range', () => {
  assert.equal(normalizePreferences({ soundVolume: 4 }).soundVolume, 1)
  assert.equal(normalizePreferences({ soundVolume: -2 }).soundVolume, 0)
})
