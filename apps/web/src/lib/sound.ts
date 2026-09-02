export type SoundName = 'select' | 'success' | 'miss' | 'bonus'

let audioContext: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  audioContext ??= new AudioContext()
  return audioContext
}

export function unlockAudio() {
  const audio = context()
  if (!audio) return
  if (audio.state !== 'running') {
    void audio.resume().catch(() => undefined)
  }
}

const SOUND_NOTES: Record<SoundName, Array<[number, number]>> = {
  select: [[520, 0.035]],
  success: [
    [660, 0.07],
    [880, 0.11],
  ],
  miss: [[220, 0.09]],
  bonus: [
    [440, 0.05],
    [660, 0.05],
    [990, 0.1],
  ],
}

const PEAK_GAIN = 0.25

export function playSound(name: SoundName, enabled: boolean, volume: number) {
  if (!enabled || volume <= 0) return
  void playNotes(name, Math.min(1, volume) * PEAK_GAIN)
}

async function playNotes(name: SoundName, peakGain: number) {
  const audio = context()
  if (!audio) return
  if (audio.state !== 'running') {
    try {
      await audio.resume()
    } catch {
      return
    }
  }
  if (audio.state !== 'running') return

  let start = audio.currentTime
  for (const [frequency, duration] of SOUND_NOTES[name]) {
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = name === 'miss' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(peakGain, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.start(start)
    oscillator.stop(start + duration)
    start += duration * 0.72
  }
}
