import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { getUnlockedAchievements } from '#/lib/achievements'
import { initialPlayerState } from '#/lib/player-state'

describe('achievements', () => {
  it('unlocks from local play statistics', () => {
    const unlocked = getUnlockedAchievements({
      ...initialPlayerState,
      best: 1200,
      plays: 25,
      streak: 7,
      history: [
        {
          id: 'daily-run',
          playedAt: '2026-08-31T00:00:00.000Z',
          score: 1200,
          maxCombo: 10,
          daily: true,
          durationSeconds: 60,
        },
      ],
    })

    assert.deepEqual(unlocked, [
      'first_play',
      'score_1000',
      'combo_10',
      'daily_first',
      'streak_7',
      'veteran_25',
    ])
  })

  it('retains previous unlocks without duplicates', () => {
    const unlocked = getUnlockedAchievements({
      ...initialPlayerState,
      unlockedAchievements: ['first_play', 'first_play'],
    })
    assert.deepEqual(unlocked, ['first_play'])
  })
})
