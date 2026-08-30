import type { PlayerState } from './player-state'

export const ACHIEVEMENT_IDS = [
  'first_play',
  'score_1000',
  'combo_10',
  'daily_first',
  'streak_7',
  'veteran_25',
] as const

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number]

export function getUnlockedAchievements(state: PlayerState) {
  const unlocked = new Set<AchievementId>(
    state.unlockedAchievements.filter((id): id is AchievementId =>
      ACHIEVEMENT_IDS.includes(id as AchievementId),
    ),
  )
  if (state.plays >= 1) unlocked.add('first_play')
  if (state.best >= 1000) unlocked.add('score_1000')
  if (state.history.some((record) => record.maxCombo >= 10)) {
    unlocked.add('combo_10')
  }
  if (state.history.some((record) => record.daily)) unlocked.add('daily_first')
  if (state.streak >= 7) unlocked.add('streak_7')
  if (state.plays >= 25) unlocked.add('veteran_25')
  return ACHIEVEMENT_IDS.filter((id) => unlocked.has(id))
}
