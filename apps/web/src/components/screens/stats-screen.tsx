import { Star } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { ScreenTitle } from '#/components/shared/screen-title'
import { formatPlayedAt } from '#/lib/format'
import type { LeaderboardResponse } from '#/lib/api'
import type { PlayerState } from '#/lib/player-state'

export function StatsScreen({
  leaderboard,
  leaderboardStatus,
  state,
  onRetryLeaderboard,
}: {
  leaderboard: LeaderboardResponse | null
  leaderboardStatus: 'idle' | 'loading' | 'ready' | 'error'
  state: PlayerState
  onRetryLeaderboard: () => void
}) {
  const { i18n, t } = useTranslation()
  const average = state.plays ? Math.round(state.total / state.plays) : 0
  const historyMaxCombo = state.history.reduce(
    (maximum, record) => Math.max(maximum, record.maxCombo),
    0,
  )
  const totalMinutes = Math.round(
    state.history.reduce((total, record) => total + record.durationSeconds, 0) /
      60,
  )

  return (
    <section>
      <ScreenTitle title={t('ranking.title')} icon={Star} />
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label={t('ranking.games')}
          value={state.plays.toLocaleString()}
        />
        <StatCard
          label={t('profile.best')}
          value={state.best.toLocaleString()}
          accent
        />
        <StatCard
          label={t('profile.average')}
          value={average.toLocaleString()}
        />
        <StatCard label={t('ranking.maxCombo')} value={`×${historyMaxCombo}`} />
        <StatCard
          label={t('ranking.playTime')}
          value={t('ranking.minutes', { count: totalMinutes })}
        />
        <StatCard
          label={t('daily.streak')}
          value={t('daily.days', { count: state.streak })}
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold tracking-wide">
        {t('ranking.leaderboardTitle')}
      </h2>
      <div className="rounded-3xl border bg-card px-4">
        {leaderboardStatus === 'loading' && !leaderboard ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('network.loading')}
          </p>
        ) : leaderboardStatus === 'error' && !leaderboard ? (
          <div className="py-7 text-center">
            <p className="text-sm text-muted-foreground">
              {t('network.leaderboardError')}
            </p>
            <button
              type="button"
              className="mt-2 text-xs font-bold text-accent underline-offset-4 hover:underline"
              onClick={onRetryLeaderboard}
            >
              {t('network.retry')}
            </button>
          </div>
        ) : leaderboard?.entries.length ? (
          leaderboard.entries.map((entry) => {
            const isMine =
              leaderboard.mine !== null && entry.rank === leaderboard.mine.rank
            return (
              <div
                key={entry.playerId}
                className={`flex items-center justify-between border-b py-3 last:border-0 ${isMine ? 'text-accent' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-xs font-bold tabular-nums">
                    {entry.rank}
                  </span>
                  <span className="block text-xs font-bold">
                    {entry.name}
                    {isMine ? ` (${t('ranking.you')})` : ''}
                  </span>
                </div>
                <div className="text-right">
                  <strong className="block text-lg tabular-nums">
                    {entry.score.toLocaleString()}
                  </strong>
                  <span className="text-[10px] text-muted-foreground">
                    ×{entry.combo}
                  </span>
                </div>
              </div>
            )
          })
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('ranking.leaderboardEmpty')}
          </p>
        )}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold tracking-wide">
        {t('ranking.recent')}
      </h2>
      <div className="rounded-3xl border bg-card px-4">
        {state.history.length ? (
          state.history.slice(0, 10).map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between border-b py-3 last:border-0"
            >
              <div>
                <span className="block text-xs font-bold">
                  {record.daily ? t('daily.title') : t('ranking.normal')}
                </span>
                <time className="text-[10px] text-muted-foreground">
                  {formatPlayedAt(record.playedAt, i18n.resolvedLanguage)}
                </time>
              </div>
              <div className="text-right">
                <strong className="block text-lg tabular-nums">
                  {record.score.toLocaleString()}
                </strong>
                <span className="text-[10px] text-muted-foreground">
                  ×{record.maxCombo}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('ranking.empty')}
          </p>
        )}
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <strong
        className={`mt-1 block text-xl tabular-nums ${accent ? 'text-accent' : ''}`}
      >
        {value}
      </strong>
    </div>
  )
}
