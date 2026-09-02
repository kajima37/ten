async function disableServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    registrations.map((registration) => registration.unregister()),
  )
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.MODE === 'worker') {
    void disableServiceWorker()
    return
  }
  if (!import.meta.env.PROD) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  })
}
