import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export function vibrate(duration: number, enabled: boolean) {
  if (!enabled) return
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({
      style: duration > 10 ? ImpactStyle.Medium : ImpactStyle.Light,
    }).catch(() => undefined)
    return
  }

  try {
    navigator.vibrate(duration)
  } catch {
    // Vibration is a progressive enhancement and is unavailable on some browsers.
  }
}
