import { STORAGE_KEYS, readJson, writeJson } from '#/lib/storage'

const MIN_INTERVAL_MS = 90_000
const GAMES_BETWEEN_ADS = 3
const SKIP_FIRST_GAMES = 1

export type AdFrequency = {
  lastInterstitialAt: string | null
  gamesPlayedSinceAd: number
  totalGames: number
}

export const initialAdFrequency: AdFrequency = {
  lastInterstitialAt: null,
  gamesPlayedSinceAd: 0,
  totalGames: 0,
}

function normalize(value: unknown): AdFrequency {
  if (!value || typeof value !== 'object') return initialAdFrequency
  const source = value as Record<string, unknown>
  const lastInterstitialAt =
    typeof source.lastInterstitialAt === 'string'
      ? source.lastInterstitialAt
      : null
  const gamesPlayedSinceAd =
    typeof source.gamesPlayedSinceAd === 'number' &&
    Number.isFinite(source.gamesPlayedSinceAd) &&
    source.gamesPlayedSinceAd >= 0
      ? Math.floor(source.gamesPlayedSinceAd)
      : 0
  const totalGames =
    typeof source.totalGames === 'number' &&
    Number.isFinite(source.totalGames) &&
    source.totalGames >= 0
      ? Math.floor(source.totalGames)
      : 0
  return { lastInterstitialAt, gamesPlayedSinceAd, totalGames }
}

export function readAdFrequency(): AdFrequency {
  return normalize(readJson<unknown>(STORAGE_KEYS.adFrequency))
}

export function writeAdFrequency(state: AdFrequency) {
  writeJson(STORAGE_KEYS.adFrequency, state)
}

export function recordGameFinished(): AdFrequency {
  const current = readAdFrequency()
  const next: AdFrequency = {
    lastInterstitialAt: current.lastInterstitialAt,
    gamesPlayedSinceAd: current.gamesPlayedSinceAd + 1,
    totalGames: current.totalGames + 1,
  }
  writeAdFrequency(next)
  return next
}

export function markInterstitialShown(now: Date = new Date()): AdFrequency {
  const current = readAdFrequency()
  const next: AdFrequency = {
    lastInterstitialAt: now.toISOString(),
    gamesPlayedSinceAd: 0,
    totalGames: current.totalGames,
  }
  writeAdFrequency(next)
  return next
}

export function shouldShowInterstitial(
  daily: boolean,
  now: Date = new Date(),
): boolean {
  if (daily) return false
  const state = readAdFrequency()
  if (state.totalGames <= SKIP_FIRST_GAMES) return false
  if (state.gamesPlayedSinceAd < GAMES_BETWEEN_ADS) return false
  if (state.lastInterstitialAt === null) return true
  const lastShown = Date.parse(state.lastInterstitialAt)
  if (!Number.isFinite(lastShown)) return true
  return now.getTime() - lastShown >= MIN_INTERVAL_MS
}
