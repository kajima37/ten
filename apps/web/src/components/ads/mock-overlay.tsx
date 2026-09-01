import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { completeMockAd, getAdsClient } from '#/lib/ads'
import type { MockState } from '#/lib/ads'

function useMockState(): MockState {
  const client = getAdsClient()
  const [snapshot, setSnapshot] = useState<MockState>(() =>
    client.getMockState(),
  )
  useEffect(
    () => client.subscribeMock(() => setSnapshot(client.getMockState())),
    [client],
  )
  return snapshot
}

export function MockAdOverlay() {
  const state = useMockState()
  if (state.kind !== 'showing') return null
  return <MockAdCard state={state} />
}

function MockAdCard({
  state,
}: {
  state: Extract<MockState, { kind: 'showing' }>
}) {
  const { t } = useTranslation()
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, state.durationMs - (Date.now() - state.startedAt)),
  )

  useEffect(() => {
    setRemainingMs(
      Math.max(0, state.durationMs - (Date.now() - state.startedAt)),
    )
    const id = window.setInterval(() => {
      setRemainingMs(
        Math.max(0, state.durationMs - (Date.now() - state.startedAt)),
      )
    }, 250)
    return () => window.clearInterval(id)
  }, [state.durationMs, state.startedAt])

  useEffect(() => {
    if (remainingMs > 0) return
    if (state.variant === 'rewarded') {
      completeMockAd({ rewarded: true })
    } else {
      completeMockAd({ rewarded: false, reason: 'dismissed' })
    }
  }, [remainingMs, state.variant])

  const remainingSeconds = Math.ceil(remainingMs / 1000)
  const isRewarded = state.variant === 'rewarded'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mock-ad-title"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/85 px-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-[1.8rem] border-2 border-accent bg-card p-7 text-center shadow-2xl shadow-black/70">
        <span className="inline-block rounded-full border border-accent px-3 py-0.5 text-[10px] font-black tracking-[0.18em] text-accent">
          {t('ads.mockBadge')}
        </span>
        <h2
          id="mock-ad-title"
          className="mt-4 text-xl font-black tracking-[0.08em]"
        >
          {isRewarded ? t('ads.rewardedTitle') : t('ads.interstitialTitle')}
        </h2>
        <div className="my-6 grid aspect-video place-items-center rounded-2xl bg-secondary/70 text-[10px] tracking-[0.22em] text-muted-foreground">
          {t('ads.placeholder')}
        </div>
        {isRewarded ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t('ads.rewardedBody', { seconds: remainingSeconds })}
            </p>
            <button
              type="button"
              className="mt-5 w-full rounded-full bg-secondary px-4 py-3 text-sm font-bold text-muted-foreground disabled:opacity-40"
              disabled={remainingMs > 0}
              onClick={() =>
                completeMockAd({
                  rewarded: remainingMs <= 0,
                  reason: 'canceled',
                })
              }
            >
              {remainingMs > 0
                ? t('ads.skipIn', { seconds: remainingSeconds })
                : t('ads.claimReward')}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t('ads.interstitialBody', { seconds: remainingSeconds })}
            </p>
            <button
              type="button"
              className="mt-5 w-full rounded-full bg-secondary px-4 py-3 text-sm font-bold text-muted-foreground disabled:opacity-40"
              disabled={remainingMs > 0}
              onClick={() =>
                completeMockAd({ rewarded: false, reason: 'dismissed' })
              }
            >
              {remainingMs > 0
                ? t('ads.skipIn', { seconds: remainingSeconds })
                : t('ads.close')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
