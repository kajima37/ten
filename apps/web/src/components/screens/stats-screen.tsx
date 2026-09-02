import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ScreenTitle } from '#/components/shared/screen-title'
import { Button } from '#/components/ui/button'
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
  const [socialError, setSocialError] = useState('')
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
      <ScreenTitle title={t('ranking.title')} />
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

      <div
        className="mb-4 mt-6 grid grid-cols-3 rounded-2xl bg-secondary p-1"
        role="tablist"
      >
        {(['daily', 'weekly', 'friends'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={scope === value}
            className={`h-10 rounded-xl text-xs font-bold ${scope === value ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground'}`}
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
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 rounded-2xl border bg-card p-1.5 text-xs">
          <button
            type="button"
            className="flex h-11 min-w-0 items-center gap-1 rounded-xl px-2 font-bold text-accent hover:bg-secondary disabled:text-muted-foreground"
            disabled={!canShowPreviousWeek}
            onClick={onPreviousWeek}
          >
            <CaretLeft className="size-4 shrink-0" weight="bold" />
            {t('ranking.previousWeek')}
          </button>
          <time className="rounded-xl bg-secondary px-3 py-2 font-bold tabular-nums">
            {weekKey}
          </time>
          <button
            type="button"
            className="flex h-11 min-w-0 items-center justify-end gap-1 rounded-xl px-2 font-bold text-accent hover:bg-secondary disabled:text-muted-foreground"
            disabled={!canShowNewerWeek}
            onClick={onNextWeek}
          >
            {t('ranking.nextWeek')}
            <CaretRight className="size-4 shrink-0" weight="bold" />
          </button>
        </div>
      )}
      <div className="flex flex-col">
        {scope === 'friends' && (
          <section className="order-2 mt-3 overflow-hidden rounded-3xl border bg-card">
            <div className="border-b p-4">
              <div className="flex items-center gap-2">
                <UsersThree className="size-5 text-accent" weight="duotone" />
                <h3 className="text-sm font-bold">
                  {t('ranking.friendsTitle')}
                </h3>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('ranking.shareCodeHint')}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
                <div>
                  <span className="block text-[10px] font-bold text-muted-foreground">
                    {t('ranking.yourCode')}
                  </span>
                  <strong className="select-all font-mono text-base tracking-[0.2em] text-foreground">
                    {social.friendCode ?? '--------'}
                  </strong>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 shrink-0 rounded-xl text-xs text-accent"
                  onClick={() =>
                    void social
                      .rotateCode()
                      .then((success) =>
                        setSocialError(success ? '' : t('ranking.socialError')),
                      )
                  }
                >
                  <ArrowsClockwise className="size-4" weight="bold" />
                  {t('ranking.rotateCode')}
                </Button>
              </div>
            </div>
            <form
              className="space-y-3 p-4"
              onSubmit={(event) => {
                event.preventDefault()
                void social.sendRequest(friendCode).then((sent) => {
                  if (sent) {
                    setFriendCode('')
                    setSocialError('')
                  } else {
                    setSocialError(t('ranking.socialError'))
                  }
                })
              }}
            >
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-accent" weight="duotone" />
                <div>
                  <h3 className="text-sm font-bold">
                    {t('ranking.addFriendTitle')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {t('ranking.addFriendHint')}
                  </p>
                </div>
              </div>
              <input
                className="h-12 w-full rounded-xl border bg-background px-4 text-sm uppercase outline-none focus:ring-2 focus:ring-accent"
                maxLength={8}
                placeholder={t('ranking.friendCode')}
                value={friendCode}
                onChange={(event) =>
                  setFriendCode(event.target.value.toUpperCase())
                }
              />
              <Button
                type="submit"
                className="h-12 w-full rounded-xl font-bold"
              >
                <UserPlus className="size-5" weight="bold" />
                {t('ranking.addFriend')}
              </Button>
            </form>
            {socialError && (
              <p
                className="border-t px-4 py-3 text-xs text-destructive"
                role="alert"
              >
                {socialError}
              </p>
            )}
            {!!social.requests.length && (
              <div className="border-t p-4">
                <h3 className="mb-2 text-xs font-bold text-muted-foreground">
                  {t('ranking.requests')}
                </h3>
                <div className="space-y-2">
                  {social.requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-3 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm font-bold">
                        {request.name}
                      </span>
                      {request.direction === 'incoming' ? (
                        <span className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 rounded-lg px-3 text-xs"
                            onClick={() =>
                              void social
                                .respond(request.id, 'accept')
                                .then((success) =>
                                  setSocialError(
                                    success ? '' : t('ranking.socialError'),
                                  ),
                                )
                            }
                          >
                            {t('ranking.accept')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 rounded-lg px-3 text-xs text-muted-foreground"
                            onClick={() =>
                              void social
                                .respond(request.id, 'decline')
                                .then((success) =>
                                  setSocialError(
                                    success ? '' : t('ranking.socialError'),
                                  ),
                                )
                            }
                          >
                            {t('ranking.decline')}
                          </Button>
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t('ranking.pending')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!social.friends.length && (
              <div className="border-t p-4">
                <h3 className="mb-2 text-xs font-bold text-muted-foreground">
                  {t('ranking.friendList')}
                </h3>
                <div className="space-y-2">
                  {social.friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-3 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm font-bold">
                        {friend.name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t('daily.days', { count: friend.streak })}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 shrink-0 rounded-lg px-3 text-xs text-muted-foreground"
                        onClick={() =>
                          void social
                            .remove(friend.id)
                            .then((success) =>
                              setSocialError(
                                success ? '' : t('ranking.socialError'),
                              ),
                            )
                        }
                      >
                        {t('ranking.removeFriend')}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        <div className="order-1 rounded-3xl border bg-card px-4">
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
