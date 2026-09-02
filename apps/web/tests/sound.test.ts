import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import { playSound } from '#/lib/sound'

type OscillatorNode = {
  type: string
  frequency: { setValueAtTime: Mock }
  connect: Mock
  start: Mock
  stop: Mock
}

type GainNode = {
  gain: {
    setValueAtTime: Mock
    exponentialRampToValueAtTime: Mock
  }
  connect: Mock
}

type ContextMock = {
  state: AudioContextState
  currentTime: number
  destination: Record<string, never>
  resume: Mock<() => Promise<void>>
  createOscillator: Mock<() => OscillatorNode>
  createGain: Mock<() => GainNode>
}

function createContextMock(state: AudioContextState) {
  const oscillators: Array<OscillatorNode> = []
  const gains: Array<GainNode> = []
  const context = {
    state,
    currentTime: 1.5,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    createOscillator: vi.fn(() => {
      const oscillator: OscillatorNode = {
        type: '',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(oscillator)
      return oscillator
    }),
    createGain: vi.fn(() => {
      const gain: GainNode = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }
      gains.push(gain)
      return gain
    }),
  } satisfies ContextMock
  return { context, oscillators, gains }
}

async function loadSoundModule(contextMock: ContextMock) {
  vi.resetModules()
  const AudioContext = vi.fn(function AudioContextMock() {
    return contextMock
  })
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: AudioContext,
  })
  return await import('#/lib/sound')
}

describe('playSound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: undefined,
    })
  })

  it('does not create an AudioContext when disabled', async () => {
    const { context } = createContextMock('running')
    const AudioContext = vi.fn(function AudioContextMock() {
      return context
    })
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: AudioContext,
    })

    playSound('select', false, 0.65)
    playSound('select', true, 0)

    assert.equal(AudioContext.mock.calls.length, 0)
  })

  it('waits for resume before scheduling notes while suspended', async () => {
    const { context, oscillators, gains } = createContextMock('suspended')
    const { playSound: freshPlaySound } = await loadSoundModule(context)

    freshPlaySound('select', true, 1)

    assert.equal(context.createOscillator.mock.calls.length, 0)
    await vi.waitFor(() => {
      assert.equal(oscillators.length, 1)
    })
    assert.equal(context.resume.mock.calls.length, 1)
    assert.equal(
      oscillators[0]?.frequency.setValueAtTime.mock.calls[0]?.[1],
      1.5,
    )
    assert.equal(gains[0]?.gain.setValueAtTime.mock.calls[0]?.[0], 0.25)
  })

  it('does not schedule notes when the context stays suspended', async () => {
    const { context } = createContextMock('suspended')
    context.resume.mockImplementation(async () => undefined)

    await loadSoundModule(context)
    playSound('select', true, 1)
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    assert.equal(context.createOscillator.mock.calls.length, 0)
  })

  it('does not schedule notes when resume rejects', async () => {
    const { context } = createContextMock('suspended')
    context.resume.mockRejectedValue(new Error('denied'))

    await loadSoundModule(context)
    playSound('select', true, 1)
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    assert.equal(context.createOscillator.mock.calls.length, 0)
  })

  it('schedules immediately when the context is already running', async () => {
    const { context, oscillators } = createContextMock('running')
    const { playSound: freshPlaySound } = await loadSoundModule(context)

    freshPlaySound('success', true, 0.65)

    await vi.waitFor(() => {
      assert.equal(oscillators.length, 2)
    })
    assert.equal(context.resume.mock.calls.length, 0)
    assert.equal(oscillators[0]?.type, 'sine')
  })

  it('uses a triangle wave and reduced pitch for miss', async () => {
    const { context, oscillators } = createContextMock('running')
    const { playSound: freshPlaySound } = await loadSoundModule(context)

    freshPlaySound('miss', true, 1)

    await vi.waitFor(() => {
      assert.equal(oscillators.length, 1)
    })
    assert.equal(oscillators[0]?.type, 'triangle')
    assert.equal(
      oscillators[0]?.frequency.setValueAtTime.mock.calls[0]?.[0],
      220,
    )
  })
})

describe('unlockAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: undefined,
    })
  })

  it('resumes a suspended context', async () => {
    const { context } = createContextMock('suspended')
    const { unlockAudio: freshUnlockAudio } = await loadSoundModule(context)

    freshUnlockAudio()

    assert.equal(context.resume.mock.calls.length, 1)
  })

  it('does nothing when the context is running', async () => {
    const { context } = createContextMock('running')
    const { unlockAudio: freshUnlockAudio } = await loadSoundModule(context)

    freshUnlockAudio()

    assert.equal(context.resume.mock.calls.length, 0)
  })
})
