import { Fire, Question } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { Button } from '#/components/ui/button'
import { Metric } from '#/components/shared/metric'
import { ScreenTitle } from '#/components/shared/screen-title'
import { formatShortDate, topPercent } from '#/lib/format'
import type { LeaderboardResponse } from '#/lib/api'
import type { DailyRecord } from '#/lib/player-state'

export function DailyScreen({
  dateKey,
  leaderboard,
  record,
  streak,
  onPlay,
}: {
  dateKey: string
  leaderboard: LeaderboardResponse | null
  record: DailyRecord
  streak: number
  onPlay: () => void
}) {
  const { i18n, t } = useTranslation()
  const today = new Date(`${dateKey}T12:00:00`)
  const date = formatShortDate(today, i18n.resolvedLanguage)
  const mine = leaderboard?.mine ?? null
  const rankPercent =
    mine?.topPercent ?? (record.best ? topPercent(record.best) : null)
  return (
    <section>
      <ScreenTitle title={t('daily.title')} icon={Question} />
      <div className="rounded-3xl border bg-card p-6 text-center">
        <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">
          {date}
        </span>
        <div className="mx-auto my-5 grid size-36 place-items-center rounded-full border border-dashed border-muted-foreground text-5xl font-black shadow-[inset_0_0_0_10px_rgba(255,255,255,0.02)]">
          10
        </div>
        <p className="text-sm text-muted-foreground">{t('daily.invitation')}</p>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric
          label={t('daily.record')}
          value={record.best.toLocaleString()}
          accent
        />
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
        <Metric label={t('daily.playCount')} value={String(record.plays)} />
        <Metric
          label={t('daily.streak')}
          value={t('daily.days', { count: streak })}
          icon={Fire}
        />
      </div>
      <Button
        className="h-13 w-full rounded-full text-base font-black"
        onClick={onPlay}
      >
        {t('daily.play')}
      </Button>
    </section>
  )
}
