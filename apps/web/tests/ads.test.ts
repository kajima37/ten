import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadAdsModule(search = '/') {
  window.history.replaceState({}, '', search)
  vi.resetModules()
  return import('#/lib/ads')
}

describe('ads client (web mock)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in mock mode on web and toggles between mock and silent', async () => {
    const { getAdsClient } = await loadAdsModule()
    const client = getAdsClient()
    expect(client.getMode()).toBe('mock')

    client.setMode('silent')
    expect(client.getMode()).toBe('silent')
    expect(window.localStorage.getItem('ten_ads_mode')).toBe('silent')

    client.setMode('mock')
    expect(window.localStorage.getItem('ten_ads_mode')).toBe('mock')
  })

  it('starts in silent mode when ?ads=off is set', async () => {
    const { getAdsClient } = await loadAdsModule('/?ads=off')
    const client = getAdsClient()
    expect(client.getMode()).toBe('silent')
    await expect(client.showRewarded()).resolves.toEqual({
      rewarded: false,
      reason: 'unavailable',
    })
    await expect(client.showInterstitial()).resolves.toBeUndefined()
  })

  it('returns unavailable for all ads when ?ads=fail is set', async () => {
    const { getAdsClient } = await loadAdsModule('/?ads=fail')
    const client = getAdsClient()
    await expect(client.showRewarded()).resolves.toEqual({
      rewarded: false,
      reason: 'unavailable',
    })
    await expect(client.showInterstitial()).resolves.toBeUndefined()
  })

  it('requires the completed mock UI to claim a rewarded ad', async () => {
    const { completeMockAd, getAdsClient } = await loadAdsModule()
    const client = getAdsClient()
    expect(client.getMockState().kind).toBe('idle')

    vi.useFakeTimers()
    const promise = client.showRewarded()
    expect(client.getMockState().kind).toBe('showing')
    const state = client.getMockState()
    if (state.kind !== 'showing') throw new Error('expected showing')
    expect(state.variant).toBe('rewarded')

    await vi.runAllTimersAsync()
    expect(client.getMockState().kind).toBe('showing')
    completeMockAd({ rewarded: true })
    await expect(promise).resolves.toEqual({ rewarded: true })
    expect(client.getMockState().kind).toBe('idle')
  })

  it('supports cancelation of a rewarded ad via completeMockAd', async () => {
    const { getAdsClient, completeMockAd } = await loadAdsModule()
    const client = getAdsClient()

    vi.useFakeTimers()
    const promise = client.showRewarded()
    expect(client.getMockState().kind).toBe('showing')

    completeMockAd({ rewarded: false, reason: 'canceled' })
    await expect(promise).resolves.toEqual({
      rewarded: false,
      reason: 'canceled',
    })
    expect(client.getMockState().kind).toBe('idle')
  })

  it('requires the completed mock UI to close an interstitial', async () => {
    const { completeMockAd, getAdsClient } = await loadAdsModule()
    const client = getAdsClient()

    vi.useFakeTimers()
    const promise = client.showInterstitial()
    expect(client.getMockState().kind).toBe('showing')

    await vi.runAllTimersAsync()
    expect(client.getMockState().kind).toBe('showing')
    completeMockAd({ rewarded: false, reason: 'dismissed' })
    await expect(promise).resolves.toBeUndefined()
    expect(client.getMockState().kind).toBe('idle')
  })

  it('notifies subscribers when the mode changes', async () => {
    const { getAdsClient } = await loadAdsModule()
    const client = getAdsClient()
    const seen: Array<string> = []
    const unsubscribe = client.subscribeMock(() => seen.push(client.getMode()))

    client.setMode('silent')
    client.setMode('mock')
    expect(seen).toEqual(['silent', 'mock'])

    unsubscribe()
    client.setMode('silent')
    expect(seen).toEqual(['silent', 'mock'])
  })
})
