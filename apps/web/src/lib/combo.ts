export type ComboTier = 'normal' | 'fever' | 'blazing'

export function getComboTier(combo: number): ComboTier {
  if (combo >= 10) return 'blazing'
  if (combo >= 5) return 'fever'
  return 'normal'
}
