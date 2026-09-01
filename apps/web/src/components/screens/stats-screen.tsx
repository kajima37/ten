import { Star } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ScreenTitle } from '#/components/shared/screen-title'
import { formatPlayedAt } from '#/lib/format'
import type { LeaderboardResponse, WeeklyLeaderboardResponse } from '#/lib/api'
import type { useSocial } from '#/hooks/use-social'
import type { PlayerState } from '#/lib/player-state'

export function StatsScreen({
  leaderboard,
  leaderboardStatus,
  weeklyLeaderboard,
  weeklyLeaderboardStatus,
  friendLeaderboard,
  friendLeaderboardStatus,
  weekKey,
  canShowPreviousWeek,
  canShowNewerWeek,
  onPreviousWeek,
  onNextWeek,
  playerId,
  social,
  state,
  onRetryLeaderboard,
}: {
  leaderboard: LeaderboardResponse | null
  leaderboardStatus: 'idle' | 'loading' | 'ready' | 'error'
  weeklyLeaderboard: WeeklyLeaderboardResponse | null
  weeklyLeaderboardStatus: 'idle' | 'loading' | 'ready' | 'error'
  friendLeaderboard: WeeklyLeaderboardResponse | null
  friendLeaderboardStatus: 'idle' | 'loading' | 'ready' | 'error'
  weekKey: string
  canShowPreviousWeek: boolean
  canShowNewerWeek: boolean
  onPreviousWeek: () => void
  onNextWeek: () => void
  playerId: string | null
  social: ReturnType<typeof useSocial>
  state: PlayerState
  onRetryLeaderboard: () => void
}) {
  const { i18n, t } = useTranslation()
  const [scope, setScope] = useState<'daily' | 'weekly' | 'friends'>('daily')
  const [friendCode, setFriendCode] = useState('')
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

      <div className="mb-2 mt-6 flex gap-2" role="tablist">
        {(['daily', 'weekly', 'friends'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={scope === value}
            className={`rounded-full px-3 py-1 text-xs font-bold ${scope === value ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'}`}
            onClick={() => setScope(value)}
          >
            {t(`ranking.${value}`)}
          </button>
        ))}
      </div>
      <h2 className="mb-2 text-sm font-bold tracking-wide">
        {t(`ranking.${scope}Title`)}
      </h2>
      {scope !== 'daily' && (
        <div className="mb-2 flex items-center justify-between text-xs">
          <button
            type="button"
            className="rounded-full px-2 py-1 font-bold text-accent disabled:text-muted-foreground"
            disabled={!canShowPreviousWeek}
            onClick={onPreviousWeek}
          >
            {t('ranking.previousWeek')}
          </button>
          <time className="font-bold tabular-nums">{weekKey}</time>
          <button
            type="button"
            className="rounded-full px-2 py-1 font-bold text-accent disabled:text-muted-foreground"
            disabled={!canShowNewerWeek}
            onClick={onNextWeek}
          >
            {t('ranking.nextWeek')}
          </button>
        </div>
      )}
      <div className="rounded-3xl border bg-card px-4">
        {currentStatus(
          scope,
          leaderboardStatus,
          weeklyLeaderboardStatus,
          friendLeaderboardStatus,
        ) === 'loading' &&
        !currentLeaderboard(
          scope,
          leaderboard,
          weeklyLeaderboard,
          friendLeaderboard,
        ) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('network.loading')}
          </p>
        ) : currentStatus(
            scope,
            leaderboardStatus,
            weeklyLeaderboardStatus,
            friendLeaderboardStatus,
          ) === 'error' &&
          !currentLeaderboard(
            scope,
            leaderboard,
            weeklyLeaderboard,
            friendLeaderboard,
          ) ? (
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
        ) : currentLeaderboard(
            scope,
            leaderboard,
            weeklyLeaderboard,
            friendLeaderboard,
          )?.entries.length ? (
          currentLeaderboard(
            scope,
            leaderboard,
            weeklyLeaderboard,
            friendLeaderboard,
          )?.entries.map((entry) => {
            const isMine = entry.playerId === playerId
            const weeklyEntry = 'streak' in entry ? entry : null
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
                    {weeklyEntry
                      ? ` · ${t('daily.days', { count: weeklyEntry.streak })}`
                      : ''}
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

      {scope === 'friends' && (
        <section className="mt-4 rounded-3xl border bg-card p-4">
          <h2 className="text-sm font-bold tracking-wide">
            {t('ranking.friendsTitle')}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('ranking.yourCode')}:{' '}
            <strong className="select-all tracking-[0.18em] text-foreground">
              {social.friendCode ?? '--------'}
            </strong>
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-bold text-accent underline-offset-4 hover:underline"
            onClick={() => void social.rotateCode()}
          >
            {t('ranking.rotateCode')}
          </button>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void social.sendRequest(friendCode).then((sent) => {
                if (sent) setFriendCode('')
              })
            }}
          >
            <input
              className="min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm uppercase"
              maxLength={8}
              placeholder={t('ranking.friendCode')}
              value={friendCode}
              onChange={(event) =>
                setFriendCode(event.target.value.toUpperCase())
              }
            />
            <button
              type="submit"
              className="rounded-xl bg-accent px-3 text-xs font-bold text-accent-foreground"
            >
              {t('ranking.addFriend')}
            </button>
          </form>
          {social.requests.map((request) => (
            <div
              key={request.id}
              className="mt-3 flex items-center justify-between text-xs"
            >
              <span>{request.name}</span>
              {request.direction === 'incoming' ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="font-bold text-accent"
                    onClick={() => void social.respond(request.id, 'accept')}
                  >
                    {t('ranking.accept')}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground"
                    onClick={() => void social.respond(request.id, 'decline')}
                  >
                    {t('ranking.decline')}
                  </button>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t('ranking.pending')}
                </span>
              )}
            </div>
          ))}
          {social.friends.map((friend) => (
            <div
              key={friend.id}
              className="mt-3 flex items-center justify-between text-xs"
            >
              <span>
                {friend.name} · {t('daily.days', { count: friend.streak })}
              </span>
              <button
                type="button"
                className="text-muted-foreground underline"
                onClick={() => void social.remove(friend.id)}
              >
                {t('ranking.removeFriend')}
              </button>
            </div>
          ))}
        </section>
      )}

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

function currentLeaderboard(
  scope: 'daily' | 'weekly' | 'friends',
  daily: LeaderboardResponse | null,
  weekly: WeeklyLeaderboardResponse | null,
  friends: WeeklyLeaderboardResponse | null,
) {
  return scope === 'daily' ? daily : scope === 'weekly' ? weekly : friends
}

function currentStatus(
  scope: 'daily' | 'weekly' | 'friends',
  daily: 'idle' | 'loading' | 'ready' | 'error',
  weekly: 'idle' | 'loading' | 'ready' | 'error',
  friends: 'idle' | 'loading' | 'ready' | 'error',
) {
  return scope === 'daily' ? daily : scope === 'weekly' ? weekly : friends
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
