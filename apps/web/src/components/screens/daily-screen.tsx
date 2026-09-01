import { Fire, Question } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { Button } from '#/components/ui/button'
import { Metric } from '#/components/shared/metric'
import { ScreenTitle } from '#/components/shared/screen-title'
import { formatShortDate, topPercent } from '#/lib/format'
import type { DailyRecord } from '#/lib/player-state'

export function DailyScreen({
  record,
  streak,
  onPlay,
}: {
  record: DailyRecord
  streak: number
  onPlay: () => void
}) {
  const { i18n, t } = useTranslation()
  const today = new Date()
  const date = formatShortDate(today, i18n.resolvedLanguage)
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
            record.best
              ? t('result.topPercent', { percent: topPercent(record.best) })
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
