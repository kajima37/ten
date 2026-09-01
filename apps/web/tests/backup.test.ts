import assert from 'node:assert/strict'
import test from 'node:test'

import { createBackup, parseBackup } from '../src/lib/backup.ts'
import { initialPlayerState } from '../src/lib/player-state.ts'

test('backup data round-trips through JSON', () => {
  const backup = createBackup(
    {
      playerState: { ...initialPlayerState, best: 1200 },
      language: 'en',
      theme: 'neon',
      preferences: {
        vibration: false,
        reducedMotion: true,
        sound: false,
        soundVolume: 0.25,
      },
      tutorialComplete: true,
    },
    '2026-08-31T00:00:00.000Z',
  )

  const restored = parseBackup(JSON.parse(JSON.stringify(backup)), '2026-08-31')
  assert.equal(restored.playerState.best, 1200)
  assert.equal(restored.theme, 'neon')
  assert.deepEqual(restored.preferences, {
    vibration: false,
    reducedMotion: true,
    sound: false,
    soundVolume: 0.25,
  })
  assert.equal(restored.tutorialComplete, true)
})

test('invalid backup files are rejected', () => {
  assert.throws(
    () => parseBackup({ format: 'something-else' }, '2026-08-31'),
    /backup/i,
  )
})
