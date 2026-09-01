export function topPercent(score: number) {
  return Math.max(1, Math.min(99, Math.round(100 - score / 220)))
}

export function localeForLanguage(language: string | undefined) {
  return language === 'en' ? 'en-US' : 'ja-JP'
}

export function formatShortDate(date: Date, language: string | undefined) {
  return date
    .toLocaleDateString(localeForLanguage(language), {
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()
}

export function formatPlayedAt(playedAt: string, language: string | undefined) {
  return new Date(playedAt).toLocaleString(localeForLanguage(language), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
