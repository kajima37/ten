import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { initialPreferences, normalizePreferences } from '#/lib/preferences'

describe('normalizePreferences', () => {
  it('applies sound defaults to legacy preferences', () => {
    assert.deepEqual(normalizePreferences({ vibration: false }), {
      ...initialPreferences,
      vibration: false,
    })
  })

  it('clamps sound volume to the supported range', () => {
    assert.equal(normalizePreferences({ soundVolume: 4 }).soundVolume, 1)
    assert.equal(normalizePreferences({ soundVolume: -2 }).soundVolume, 0)
  })
})
