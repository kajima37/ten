import { Capacitor } from '@capacitor/core'
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob'
import type { AdMobInitializationOptions } from '@capacitor-community/admob'

import { STORAGE_KEYS, readJson, writeStorage } from '#/lib/storage'

export type AdsMode = 'mock' | 'silent'

export type AdsResult = {
  rewarded: boolean
  reason?: 'unavailable' | 'dismissed' | 'failed' | 'canceled'
}

type MockVariant = 'rewarded' | 'interstitial'

export type MockState =
  | { kind: 'idle' }
  | {
      kind: 'showing'
      variant: MockVariant
      startedAt: number
      durationMs: number
      resolve: (result: AdsResult) => void
    }

export type AdsClient = {
  init: () => Promise<void>
  showRewarded: () => Promise<AdsResult>
  showInterstitial: () => Promise<void>
  setMode: (mode: AdsMode) => void
  getMode: () => AdsMode
  subscribeMock: (listener: () => void) => () => void
  getMockState: () => MockState
}

const REWARDED_DURATION_MS = 5_000
const INTERSTITIAL_DURATION_MS = 3_000
const QUERY_PARAM = 'ads'
const MODE_STORAGE_KEY = STORAGE_KEYS.adsMode

function readInitialMode(): AdsMode {
  if (typeof window === 'undefined') return 'mock'
  const params = new URLSearchParams(window.location.search)
  const override = params.get(QUERY_PARAM)
  if (override === 'off' || override === 'silent') return 'silent'
  if (override === 'fail') return 'mock'
  const stored = readJson<AdsMode>(MODE_STORAGE_KEY)
  if (stored === 'mock' || stored === 'silent') return stored
  return 'mock'
}

function persistMode(mode: AdsMode) {
  writeStorage(MODE_STORAGE_KEY, mode)
}

function getFailureMode(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get(QUERY_PARAM) === 'fail'
}

function createMockClient(): AdsClient {
  let state: MockState = { kind: 'idle' }
  let mode: AdsMode = readInitialMode()
  const listeners = new Set<() => void>()
  const failAll = getFailureMode()

  const notify = () => {
    for (const listener of listeners) listener()
  }

  const runMock = (
    variant: MockVariant,
    durationMs: number,
  ): Promise<AdsResult | void> =>
    new Promise((resolve) => {
      if (failAll) {
        window.setTimeout(
          () => resolve({ rewarded: false, reason: 'unavailable' }),
          300,
        )
        return
      }
      let settled = false
      const settle = (result: AdsResult) => {
        if (settled) return
        settled = true
        if (state.kind === 'showing') {
          state = { kind: 'idle' }
        }
        notify()
        resolve(result)
      }
      state = {
        kind: 'showing',
        variant,
        startedAt: Date.now(),
        durationMs,
        resolve: settle,
      }
      notify()
    })

  return {
    init: async () => undefined,
    showRewarded: async () => {
      if (mode === 'silent') {
        return { rewarded: false, reason: 'unavailable' }
      }
      const result = await runMock('rewarded', REWARDED_DURATION_MS)
      if (result === undefined) {
        return { rewarded: false, reason: 'canceled' }
      }
      return result
    },
    showInterstitial: async () => {
      if (mode === 'silent') return
      await runMock('interstitial', INTERSTITIAL_DURATION_MS)
    },
    setMode: (next) => {
      mode = next
      persistMode(next)
      notify()
    },
    getMode: () => mode,
    subscribeMock: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getMockState: () => state,
  }
}

const TEST_REWARDED_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917'
const TEST_INTERSTITIAL_UNIT_ID = 'ca-app-pub-3940256099942544/1033173712'

function readEnv(name: string): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  if (!env) return undefined
  const value = env[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function resolveRewardedUnitId(): string {
  return readEnv('VITE_ADMOB_REWARDED_UNIT_ID') ?? TEST_REWARDED_UNIT_ID
}

function resolveInterstitialUnitId(): string {
  return readEnv('VITE_ADMOB_INTERSTITIAL_UNIT_ID') ?? TEST_INTERSTITIAL_UNIT_ID
}

function createNativeClient(): AdsClient {
  let initialized = false

  const init = async () => {
    if (initialized) return
    const options: AdMobInitializationOptions = {
      initializeForTesting: false,
      maxAdContentRating:
        'G' as AdMobInitializationOptions['maxAdContentRating'],
    }
    try {
      await AdMob.initialize(options)
      try {
        const consent = await AdMob.requestConsentInfo()
        if (
          consent.isConsentFormAvailable &&
          consent.status === AdmobConsentStatus.REQUIRED
        ) {
          await AdMob.showConsentForm()
        }
        if (Capacitor.getPlatform() === 'ios') {
          try {
            await AdMob.requestTrackingAuthorization()
          } catch {
            // ATT request can fail on Android or older iOS; ignore.
          }
        }
      } catch {
        // UMP consent requires AdMob console configuration; ignore failures.
      }
      initialized = true
    } catch {
      // Initialization will retry on the next call.
    }
  }

  const showRewarded = async (): Promise<AdsResult> => {
    await init()
    const adId = resolveRewardedUnitId()
    try {
      await AdMob.prepareRewardVideoAd({ adId })
      await AdMob.showRewardVideoAd({ adId })
      return { rewarded: true }
    } catch (error) {
      return { rewarded: false, reason: classifyError(error) }
    }
  }

  const showInterstitial = async (): Promise<void> => {
    await init()
    const adId = resolveInterstitialUnitId()
    try {
      await AdMob.prepareInterstitial({ adId })
      await AdMob.showInterstitial({ adId })
    } catch {
      // Interstitial failures should not block user flow.
    }
  }

  const fallback: AdsClient = {
    init,
    showRewarded,
    showInterstitial,
    setMode: () => undefined,
    getMode: () => 'silent',
    subscribeMock: () => () => undefined,
    getMockState: () => ({ kind: 'idle' }),
  }
  return fallback
}

function classifyError(error: unknown): AdsResult['reason'] {
  if (!error || typeof error !== 'object') return 'failed'
  const message = (error as { message?: unknown }).message
  if (typeof message !== 'string') return 'failed'
  if (/cancel/i.test(message)) return 'canceled'
  if (/dismiss/i.test(message)) return 'dismissed'
  if (/no fill|not loaded|unavailable/i.test(message)) return 'unavailable'
  return 'failed'
}

let cached: AdsClient | null = null

export function getAdsClient(): AdsClient {
  if (cached) return cached
  cached = Capacitor.isNativePlatform()
    ? createNativeClient()
    : createMockClient()
  return cached
}

export function completeMockAd(result: AdsResult) {
  const client = getAdsClient()
  if (Capacitor.isNativePlatform()) return
  if (!('getMockState' in client)) return
  const state = client.getMockState()
  if (state.kind !== 'showing') return
  state.resolve(result)
}
