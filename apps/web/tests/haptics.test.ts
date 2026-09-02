import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

import { vibrate } from '#/lib/haptics'

describe('vibrate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the Web Vibration API when running on the web', () => {
    const vibrateApi = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrateApi,
    })

    vibrate(5, true)

    assert.deepEqual(vibrateApi.mock.calls, [[5]])
  })

  it('uses medium native impact for longer feedback', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)

    vibrate(18, true)

    assert.deepEqual(vi.mocked(Haptics.impact).mock.calls, [
      [{ style: ImpactStyle.Medium }],
    ])
  })

  it('does not vibrate when reduced motion is enabled', () => {
    const vibrateApi = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrateApi,
    })

    vibrate(18, true, true)

    assert.equal(vibrateApi.mock.calls.length, 0)
    assert.equal(vi.mocked(Haptics.impact).mock.calls.length, 0)
  })
})
