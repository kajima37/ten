import { describe, expect, it } from 'vitest'

import {
  markInterstitialShown,
  recordGameFinished,
  shouldShowInterstitial,
} from '#/lib/ads-frequency'

describe('ads-frequency', () => {
  it('suppresses interstitials during the first games', () => {
    expect(shouldShowInterstitial(false)).toBe(false)
    recordGameFinished()
    expect(shouldShowInterstitial(false)).toBe(false)
  })

  it('shows an interstitial once enough games have passed', () => {
    recordGameFinished()
    recordGameFinished()
    recordGameFinished()
    expect(shouldShowInterstitial(false)).toBe(true)
  })

  it('does not show another ad during the post-impression cooldown', () => {
    recordGameFinished()
    recordGameFinished()
    recordGameFinished()
    markInterstitialShown()
    expect(shouldShowInterstitial(false)).toBe(false)

    for (let i = 0; i < 3; i += 1) recordGameFinished()
    expect(shouldShowInterstitial(false)).toBe(false)
  })

  it('shows again once both the cooldown and game count are satisfied', () => {
    recordGameFinished()
    recordGameFinished()
    recordGameFinished()
    markInterstitialShown()
    for (let i = 0; i < 3; i += 1) recordGameFinished()

    const future = new Date(Date.now() + 200_000)
    expect(shouldShowInterstitial(false, future)).toBe(true)
  })

  it('never triggers interstitials during daily games', () => {
    for (let i = 0; i < 5; i += 1) recordGameFinished()
    expect(shouldShowInterstitial(true)).toBe(false)
    expect(shouldShowInterstitial(false)).toBe(true)
  })

  it('falls back to the initial state on invalid stored data', () => {
    window.localStorage.setItem('ten_ad_frequency', JSON.stringify('bad'))
    expect(shouldShowInterstitial(false)).toBe(false)
  })
})
