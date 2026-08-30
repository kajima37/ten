export const PLAYER_STATE_VERSION = 2 as const

export type DailyRecord = {
  best: number
  plays: number
}

export type PlayerState = {
  version: typeof PLAYER_STATE_VERSION
  best: number
  plays: number
  total: number
  dailyRecords: Record<string, DailyRecord>
  streak: number
  lastDailyDate: string | null
}

export const initialPlayerState: PlayerState = {
  version: PLAYER_STATE_VERSION,
  best: 0,
  plays: 0,
  total: 0,
  dailyRecords: {},
  streak: 0,
  lastDailyDate: null,
}

function nonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0
}

function readDailyRecords(value: unknown) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([date, record]) => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !record ||
        typeof record !== 'object'
      ) {
        return []
      }
      const candidate = record as Record<string, unknown>
      return [
        [
          date,
          {
            best: nonNegativeNumber(candidate.best),
            plays: nonNegativeNumber(candidate.plays),
          },
        ],
      ]
    }),
  )
}

export function migratePlayerState(
  value: unknown,
  currentDateKey: string,
): PlayerState {
  if (!value || typeof value !== 'object') return initialPlayerState
  const source = value as Record<string, unknown>
  const dailyRecords = readDailyRecords(source.dailyRecords)
  const legacyDailyBest = nonNegativeNumber(source.dailyBest)
  if (legacyDailyBest > 0 && !Object.hasOwn(dailyRecords, currentDateKey)) {
    dailyRecords[currentDateKey] = { best: legacyDailyBest, plays: 1 }
  }

  return {
    version: PLAYER_STATE_VERSION,
    best: nonNegativeNumber(source.best),
    plays: nonNegativeNumber(source.plays),
    total: nonNegativeNumber(source.total),
    dailyRecords,
    streak: nonNegativeNumber(source.streak),
    lastDailyDate:
      typeof source.lastDailyDate === 'string' ? source.lastDailyDate : null,
  }
}
