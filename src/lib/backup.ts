import { migratePlayerState } from './player-state.ts'
import type { PlayerState } from './player-state.ts'

export const BACKUP_FORMAT = 'ten-backup'
export const BACKUP_VERSION = 1 as const
export const THEME_IDS = [
  'classic',
  'midnight',
  'cafe',
  'sakura',
  'zen',
  'neon',
] as const

export type ThemeId = (typeof THEME_IDS)[number]
export type Preferences = { vibration: boolean; reducedMotion: boolean }

export type BackupData = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  playerState: PlayerState
  language: 'ja' | 'en'
  theme: ThemeId
  preferences: Preferences
  tutorialComplete: boolean
}

export function normalizePreferences(value: unknown): Preferences {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    vibration: source.vibration !== false,
    reducedMotion: source.reducedMotion === true,
  }
}

export function createBackup(
  values: Omit<BackupData, 'format' | 'version' | 'exportedAt'>,
  exportedAt = new Date().toISOString(),
): BackupData {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    ...values,
  }
}

export function parseBackup(
  value: unknown,
  currentDateKey: string,
): BackupData {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup')
  const source = value as Record<string, unknown>
  if (source.format !== BACKUP_FORMAT || source.version !== BACKUP_VERSION) {
    throw new Error('Unsupported backup')
  }

  const theme = THEME_IDS.includes(source.theme as ThemeId)
    ? (source.theme as ThemeId)
    : 'classic'

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt:
      typeof source.exportedAt === 'string'
        ? source.exportedAt
        : new Date().toISOString(),
    playerState: migratePlayerState(source.playerState, currentDateKey),
    language: source.language === 'en' ? 'en' : 'ja',
    theme,
    preferences: normalizePreferences(source.preferences),
    tutorialComplete: source.tutorialComplete === true,
  }
}
