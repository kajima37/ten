import type { FullConfig } from '@playwright/test'

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) return
  // Warm the dev server so the first test does not pay for on-demand
  // compilation of the route and its lazily loaded app shell.
  try {
    await fetch(baseURL)
  } catch {
    // The webServer check already guarantees availability; ignore warm-up errors.
  }
}
