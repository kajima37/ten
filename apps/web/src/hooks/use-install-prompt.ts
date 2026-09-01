import { useEffect, useState } from 'react'

import { STORAGE_KEYS, readStorage, writeStorage } from '#/lib/storage'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || readStorage(STORAGE_KEYS.installPromptDismissed))
      return
    const onPrompt = (next: Event) => {
      next.preventDefault()
      setEvent(next as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const install = async () => {
    if (!event) return
    await event.prompt()
    writeStorage(STORAGE_KEYS.installPromptDismissed, 'true')
    setEvent(null)
  }

  const dismiss = () => {
    writeStorage(STORAGE_KEYS.installPromptDismissed, 'true')
    setEvent(null)
  }

  return { available: event !== null, install, dismiss }
}
