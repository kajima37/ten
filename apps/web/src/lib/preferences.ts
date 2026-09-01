export type Preferences = {
  vibration: boolean
  reducedMotion: boolean
  sound: boolean
  soundVolume: number
}

export const initialPreferences: Preferences = {
  vibration: true,
  reducedMotion: false,
  sound: true,
  soundVolume: 0.65,
}

export function normalizePreferences(value: unknown): Preferences {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    vibration: source.vibration !== false,
    reducedMotion: source.reducedMotion === true,
    sound: source.sound !== false,
    soundVolume:
      typeof source.soundVolume === 'number' &&
      Number.isFinite(source.soundVolume)
        ? Math.min(1, Math.max(0, source.soundVolume))
        : 0.65,
  }
}
