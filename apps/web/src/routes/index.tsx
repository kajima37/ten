import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'

const TenGame = lazy(() => import('#/components/ten-game'))

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <ClientOnly fallback={<div className="min-h-svh bg-background" />}>
      <TenGame />
    </ClientOnly>
  )
}
