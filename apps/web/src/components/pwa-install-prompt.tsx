import { DownloadSimple, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { useInstallPrompt } from '#/hooks/use-install-prompt'

export function PwaInstallPrompt() {
  const { t } = useTranslation()
  const prompt = useInstallPrompt()
  if (!prompt.available) return null

  return (
    <aside className="fixed bottom-24 left-3 right-3 z-30 mx-auto flex max-w-[456px] items-center gap-3 rounded-2xl border bg-card p-3 shadow-xl">
      <DownloadSimple className="size-5 shrink-0 text-accent" weight="bold" />
      <p className="min-w-0 flex-1 text-xs font-medium">
        {t('pwa.installMessage')}
      </p>
      <button
        type="button"
        className="rounded-full bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
        onClick={() => void prompt.install()}
      >
        {t('pwa.install')}
      </button>
      <button
        type="button"
        className="rounded-full p-1 text-muted-foreground"
        aria-label={t('pwa.dismiss')}
        onClick={prompt.dismiss}
      >
        <X className="size-4" weight="bold" />
      </button>
    </aside>
  )
}
