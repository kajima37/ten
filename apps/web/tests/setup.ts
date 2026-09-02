import { afterEach, beforeEach, vi } from 'vitest'

const storage = new Map<string, string>()
const memoryStorage: Storage = {
  get length() {
    return storage.size
  },
  clear() {
    storage.clear()
  },
  getItem(key) {
    return storage.has(key) ? (storage.get(key) as string) : null
  },
  key(index) {
    return Array.from(storage.keys())[index] ?? null
  },
  removeItem(key) {
    storage.delete(key)
  },
  setItem(key, value) {
    storage.set(key, String(value))
  },
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  get: () => memoryStorage,
})

window.history.replaceState({}, '', '/')

beforeEach(() => {
  storage.clear()
  vi.useRealTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
})

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}))

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn().mockResolvedValue(undefined) },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' },
}))

vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: vi.fn().mockResolvedValue(undefined),
    requestConsentInfo: vi.fn().mockResolvedValue({
      isConsentFormAvailable: false,
      status: 0,
    }),
    showConsentForm: vi.fn().mockResolvedValue({}),
    requestTrackingAuthorization: vi.fn().mockResolvedValue(undefined),
    prepareRewardVideoAd: vi.fn().mockResolvedValue({ adUnitId: 'mock' }),
    showRewardVideoAd: vi.fn().mockResolvedValue({}),
    prepareInterstitial: vi.fn().mockResolvedValue({ adUnitId: 'mock' }),
    showInterstitial: vi.fn().mockResolvedValue(undefined),
  },
  AdmobConsentStatus: { REQUIRED: 1, OBTAINED: 2, NOT_REQUIRED: 0, UNKNOWN: 3 },
}))
