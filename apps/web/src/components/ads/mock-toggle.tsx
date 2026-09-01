import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getAdsClient } from '#/lib/ads'
import type { AdsMode } from '#/lib/ads'

export function MockAdsToggle() {
  const { t } = useTranslation()
  const client = getAdsClient()
  const [mode, setMode] = useState<AdsMode>(() => client.getMode())

  useEffect(() => {
    setMode(client.getMode())
    return client.subscribeMock(() => setMode(client.getMode()))
  }, [client])

  const labelKey = mode === 'mock' ? 'ads.toggleMock' : 'ads.toggleSilent'

  return (
    <button
      type="button"
      aria-label={t(labelKey)}
      onClick={() => client.setMode(mode === 'mock' ? 'silent' : 'mock')}
      className="fixed bottom-24 right-3 z-[60] rounded-full border border-accent bg-card/90 px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-accent shadow-lg shadow-black/60 backdrop-blur"
    >
      {t(labelKey)}
    </button>
  )
}
