import { Fire } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { Button } from '#/components/ui/button'
import { Metric } from '#/components/shared/metric'
import { ScreenTitle } from '#/components/shared/screen-title'
import { LEGAL_BASE_URL } from '#/lib/api'
import type { LeaderboardResponse } from '#/lib/api'
import { formatShortDate, topPercent } from '#/lib/format'
import type { DailyRecord } from '#/lib/player-state'

export function DailyScreen({
  dateKey,
  dailyStatus,
  leaderboard,
  leaderboardStatus,
  record,
  streak,
  onPlay,
  onRetryDaily,
  onRetryLeaderboard,
  showRanking,
}: {
  dateKey: string
  dailyStatus: 'loading' | 'ready' | 'error'
  leaderboard: LeaderboardResponse | null
  leaderboardStatus: 'idle' | 'loading' | 'ready' | 'error'
  record: DailyRecord
  streak: number
  onPlay: () => void
  onRetryDaily: () => void
  onRetryLeaderboard: () => void
  showRanking: boolean
}) {
  const { i18n, t } = useTranslation()
  const today = new Date(`${dateKey}T12:00:00`)
  const date = formatShortDate(today, i18n.resolvedLanguage)
  const mine = leaderboard?.mine ?? null
  const rankPercent =
    mine?.topPercent ?? (record.best ? topPercent(record.best) : null)
  return (
    <section>
      <ScreenTitle title={t('daily.title')} />
      <div className="rounded-3xl border bg-card p-6 text-center">
        <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">
          {date}
        </span>
        <div className="mx-auto my-5 grid size-36 place-items-center rounded-full border border-dashed border-muted-foreground text-5xl font-black shadow-[inset_0_0_0_10px_rgba(255,255,255,0.02)]">
          10
        </div>
        <p className="text-sm text-muted-foreground">{t('daily.invitation')}</p>
        <p className="mt-3 text-left text-[10px] leading-relaxed text-muted-foreground">
          {t('daily.onlineNotice')}{' '}
          <a
            className="underline underline-offset-2"
            href={`${LEGAL_BASE_URL}/privacy?lang=${i18n.resolvedLanguage === 'en' ? 'en' : 'ja'}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('legal.privacy')}
          </a>
        </p>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric
          label={t('daily.record')}
          value={record.best.toLocaleString()}
          accent
        />
        {showRanking && (
          <Metric
            label={t('daily.nationalRank')}
            value={
              rankPercent
                ? mine
                  ? t('daily.rankAndPercent', {
                      rank: mine.rank,
                      percent: mine.topPercent,
                    })
                  : t('result.topPercent', { percent: rankPercent })
                : t('daily.notPlayed')
            }
          />
        )}
        <Metric label={t('daily.playCount')} value={String(record.plays)} />
        <Metric
          label={t('daily.streak')}
          value={t('daily.days', { count: streak })}
          icon={Fire}
        />
      </div>
      <Button
        className="h-13 w-full rounded-full text-base font-black"
        disabled={dailyStatus === 'loading'}
        onClick={dailyStatus === 'error' ? onRetryDaily : onPlay}
      >
        {dailyStatus === 'loading'
          ? t('network.loading')
          : dailyStatus === 'error'
            ? t('network.retryDaily')
            : t('daily.play')}
      </Button>
      {showRanking && leaderboardStatus === 'error' && (
        <button
          type="button"
          className="mt-3 w-full text-center text-xs font-bold text-accent underline-offset-4 hover:underline"
          onClick={onRetryLeaderboard}
        >
          {t('network.retryLeaderboard')}
        </button>
      )}
    </section>
  )
}
