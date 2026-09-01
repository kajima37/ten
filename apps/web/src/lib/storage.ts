export const STORAGE_KEYS = {
  playerState: 'ten_state',
  language: 'ten_language',
  theme: 'ten_theme',
  tutorialComplete: 'ten_tutorial_complete',
  preferences: 'ten_preferences',
  deviceId: 'ten_device_id',
  token: 'ten_token',
  playerProfile: 'ten_player_profile',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function readStorage(key: StorageKey): string | null {
  return getStorage()?.getItem(key) ?? null
}

export function writeStorage(key: StorageKey, value: string) {
  getStorage()?.setItem(key, value)
}

export function removeStorage(key: StorageKey) {
  getStorage()?.removeItem(key)
}

export function readJson<T>(key: StorageKey): T | null {
  const raw = readStorage(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(key: StorageKey, value: unknown) {
  writeStorage(key, JSON.stringify(value))
}
