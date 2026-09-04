import { Crown } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { Button } from '#/components/ui/button'

export function HomeScreen({
  onPlay,
  onRank,
  showRanking,
}: {
  onPlay: () => void
  onRank: () => void
  showRanking: boolean
}) {
  const { t } = useTranslation()

  return (
    <section className="flex min-h-[78svh] flex-col items-center justify-center text-center">
      <div className="ten-logo mb-3 text-6xl font-black tracking-[0.13em]">
        TEN.
      </div>
      <p className="text-[11px] tracking-[0.22em] text-muted-foreground">
        {t('home.tagline')}
      </p>
      <Button
        className="mt-20 h-14 w-4/5 max-w-80 rounded-full text-base font-black"
        onClick={onPlay}
      >
        {t('home.play')}
      </Button>
      {showRanking && (
        <Button
          variant="ghost"
          className="mt-5 gap-2 text-xs text-muted-foreground"
          onClick={onRank}
        >
          <Crown className="size-4" weight="bold" /> {t('home.ranking')}
        </Button>
      )}
    </section>
  )
}
