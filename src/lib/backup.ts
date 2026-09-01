import { migratePlayerState } from './player-state.ts'
import type { PlayerState } from './player-state.ts'
import { normalizePreferences } from './preferences.ts'
import type { Preferences } from './preferences.ts'
import { THEME_IDS } from './themes.ts'
import type { ThemeId } from './themes.ts'

export const BACKUP_FORMAT = 'ten-backup'
export const BACKUP_VERSION = 1 as const

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
