export type Preferences = { vibration: boolean; reducedMotion: boolean }

export const initialPreferences: Preferences = {
  vibration: true,
  reducedMotion: false,
}

export function normalizePreferences(value: unknown): Preferences {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    vibration: source.vibration !== false,
    reducedMotion: source.reducedMotion === true,
  }
}
