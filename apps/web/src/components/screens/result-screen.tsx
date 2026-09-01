import {
  ArrowCounterClockwise,
  Crown,
  House,
  ShareFat,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '#/components/ui/button'
import { Metric } from '#/components/shared/metric'
import { downloadBlob } from '#/lib/download'
import { getLocalDateKey } from '@ten/game-core'
import { topPercent } from '#/lib/format'
import { createResultImage } from '#/lib/result-image'

export function ResultScreen({
  score,
  best,
  previousBest,
  maxCombo,
  isNewBest,
  daily,
  serverRank,
  onRetry,
  onHome,
  onToast,
}: {
  score: number
  best: number
  previousBest: number
  maxCombo: number
  isNewBest: boolean
  daily: boolean
  serverRank: { rank: number; topPercent: number } | null
  onRetry: () => void
  onHome: () => void
  onToast: (message: string) => void
}) {
  const { t } = useTranslation()
  const [sharing, setSharing] = useState(false)
  const delta = score - previousBest
  const percent = serverRank?.topPercent ?? topPercent(score)

  const shareResult = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const blob = await createResultImage({
        score,
        best,
        maxCombo,
        daily,
        labels: {
          result: t('result.title'),
          best: t('profile.best'),
          combo: t('result.maxCombo'),
          daily: t('daily.title'),
          tagline: t('home.tagline'),
        },
      })
      const file = new File([blob], `ten-score-${getLocalDateKey()}.png`, {
        type: 'image/png',
      })

      if (
        Reflect.has(navigator, 'share') &&
        Reflect.has(navigator, 'canShare') &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: t('result.shareTitle'),
          text: t('result.shareMessage', { score: score.toLocaleString() }),
          files: [file],
        })
        return
      }

      downloadBlob(blob, file.name)
      onToast(t('toast.shareDownloaded'))
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        onToast(t('toast.shareFailed'))
      }
    } finally {
      setSharing(false)
    }
  }
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          onClick={onHome}
          aria-label={t('result.home')}
        >
          <House className="size-4" weight="bold" />
        </Button>
        <strong className="tracking-[0.16em]">{t('result.title')}</strong>
        <div className="size-9" />
      </div>
      <div className="rounded-3xl border bg-card p-7 text-center">
        <Crown
          className={`result-crown mx-auto mb-2 size-8 text-accent ${isNewBest ? 'is-new-best' : ''}`}
          weight="fill"
        />
        <p className="text-xs font-bold tracking-[0.16em] text-accent">
          {isNewBest ? t('result.newBest') : t('result.title')}
        </p>
        <p className="my-3 text-6xl font-black tabular-nums">
          {score.toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('result.bestScore', { score: best.toLocaleString() })}
        </p>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric
          label={t('result.versusBest')}
          value={`${delta >= 0 ? '+' : ''}${delta.toLocaleString()}`}
          accent
        />
        <Metric
          label={t('result.nationalRank')}
          value={
            serverRank
              ? t('result.rankAndPercent', {
                  rank: serverRank.rank,
                  percent,
                })
              : t('result.topPercent', { percent })
          }
        />
        <Metric label={t('result.maxCombo')} value={`×${maxCombo}`} />
      </div>
      <Button
        className="h-13 w-full rounded-full text-base font-black"
        onClick={onRetry}
      >
        <ArrowCounterClockwise className="mr-2 size-4" weight="bold" />
        {t('result.retry')}
      </Button>
      <Button
        variant="secondary"
        className="mt-2 h-13 w-full rounded-full"
        disabled={sharing}
        onClick={() => void shareResult()}
      >
        <ShareFat className="mr-2 size-4" weight="bold" />
        {sharing ? t('result.sharing') : t('result.share')}
      </Button>
      <Button
        variant="secondary"
        className="mt-2 h-13 w-full rounded-full"
        onClick={onHome}
      >
        {t('result.home')}
      </Button>
    </section>
  )
}
