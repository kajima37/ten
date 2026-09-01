import { useCallback, useState } from 'react'

import { getUnlockedAchievements } from '#/lib/achievements'
import { getLocalDateKey, getNextStreak } from '@ten/game-core'
import type { GameEvent } from '@ten/game-core'
import { initialPlayerState, migratePlayerState } from '#/lib/player-state'
import type { PlayerState } from '#/lib/player-state'
import { STORAGE_KEYS, readJson, writeJson } from '#/lib/storage'

export type GameResult = {
  score: number
  maxCombo: number
  daily: boolean
  dailyKey: string
  durationSeconds: number
  seed: number
  events: Array<GameEvent>
}

export type GameResultOutcome = {
  previousBest: number
  isNewBest: boolean
  hasNewAchievement: boolean
}

function readPlayerState() {
  const saved = readJson<unknown>(STORAGE_KEYS.playerState)
  return saved
    ? migratePlayerState(saved, getLocalDateKey())
    : initialPlayerState
}

export function usePlayerProgress() {
  const [playerState, setPlayerState] = useState(readPlayerState)

  const saveState = useCallback((next: PlayerState) => {
    setPlayerState(next)
    writeJson(STORAGE_KEYS.playerState, next)
  }, [])

  const recordResult = useCallback(
    (result: GameResult): GameResultOutcome => {
      const previousBest = playerState.best
      const isNewBest = result.score > playerState.best
      const currentDailyRecord = playerState.dailyRecords[result.dailyKey] ?? {
        best: 0,
        plays: 0,
      }
      const nextStreak = result.daily
        ? getNextStreak(
            playerState.streak,
            playerState.lastDailyDate,
            result.dailyKey,
          )
        : playerState.streak
      const nextBase: PlayerState = {
        ...playerState,
        best: Math.max(playerState.best, result.score),
        plays: playerState.plays + 1,
        total: playerState.total + result.score,
        dailyRecords: result.daily
          ? {
              ...playerState.dailyRecords,
              [result.dailyKey]: {
                best: Math.max(currentDailyRecord.best, result.score),
                plays: currentDailyRecord.plays + 1,
              },
            }
          : playerState.dailyRecords,
        streak: nextStreak,
        lastDailyDate: result.daily
          ? result.dailyKey
          : playerState.lastDailyDate,
        history: [
          {
            id: `${Date.now()}-${playerState.plays + 1}`,
            playedAt: new Date().toISOString(),
            score: result.score,
            maxCombo: result.maxCombo,
            daily: result.daily,
            durationSeconds: result.durationSeconds,
          },
          ...playerState.history,
        ].slice(0, 100),
        unlockedAchievements: playerState.unlockedAchievements,
      }
      const unlockedAchievements = getUnlockedAchievements(nextBase)
      const hasNewAchievement =
        unlockedAchievements.length > playerState.unlockedAchievements.length
      saveState({ ...nextBase, unlockedAchievements })
      return { previousBest, isNewBest, hasNewAchievement }
    },
    [playerState, saveState],
  )

  const resetRecords = useCallback(() => {
    saveState({
      ...initialPlayerState,
      dailyRecords: {},
      history: [],
      unlockedAchievements: [],
    })
  }, [saveState])

  return { playerState, saveState, recordResult, resetRecords }
}
