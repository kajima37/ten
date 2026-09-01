import { Clock, Lightbulb, Shuffle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { Button } from '#/components/ui/button'

export function Tutorial({
  step,
  onBack,
  onNext,
  onComplete,
}: {
  step: number
  onBack: () => void
  onNext: () => void
  onComplete: () => void
}) {
  const { t } = useTranslation()
  const content = [
    { title: t('tutorial.connectTitle'), body: t('tutorial.connectBody') },
    { title: t('tutorial.comboTitle'), body: t('tutorial.comboBody') },
    { title: t('tutorial.toolsTitle'), body: t('tutorial.toolsBody') },
  ][step]

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/80 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="w-full max-w-sm rounded-[2rem] border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <strong id="tutorial-title" className="tracking-[0.14em]">
            {t('tutorial.title')}
          </strong>
          <span className="text-xs text-muted-foreground">{step + 1} / 3</span>
        </div>

        <div className="mb-6 grid min-h-48 place-items-center rounded-3xl bg-secondary p-5 text-center">
          {step === 0 && (
            <div
              className="relative flex items-center gap-3"
              aria-hidden="true"
            >
              {[2, 3, 5].map((number, index) => (
                <div key={number} className="flex items-center gap-3">
                  <span className="grid size-14 place-items-center rounded-2xl border-2 border-accent bg-card text-2xl font-black text-accent">
                    {number}
                  </span>
                  {index < 2 && <span className="h-0.5 w-5 bg-accent" />}
                </div>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="text-accent" aria-hidden="true">
              <strong className="block text-5xl">×4</strong>
              <span className="mt-2 block text-sm font-bold tracking-widest">
                COMBO
              </span>
            </div>
          )}
          {step === 2 && (
            <div className="flex gap-5 text-accent" aria-hidden="true">
              <Shuffle className="size-9" weight="duotone" />
              <Lightbulb className="size-9" weight="duotone" />
              <Clock className="size-9" weight="duotone" />
            </div>
          )}
        </div>

        <h2 className="text-center text-xl font-black">{content.title}</h2>
        <p className="mt-2 min-h-12 text-center text-sm leading-relaxed text-muted-foreground">
          {content.body}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="rounded-full"
            disabled={step === 0}
            onClick={onBack}
          >
            {t('tutorial.back')}
          </Button>
          <Button
            className="rounded-full"
            onClick={step === 2 ? onComplete : onNext}
          >
            {step === 2 ? t('tutorial.start') : t('tutorial.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
