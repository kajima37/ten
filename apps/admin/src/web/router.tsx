import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'

import { Layout } from './components/layout'
import { DashboardPage } from './routes/dashboard'
import { PlayersPage } from './routes/players'
import { PlayerDetailPage } from './routes/player-detail'
import { BannedIpsPage } from './routes/banned-ips'
import { AuditPage } from './routes/audit'
import type { SearchType } from './lib/api'

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

type PlayersSearch = { q?: string; type?: SearchType }

function validatePlayersSearch(search: Record<string, unknown>): PlayersSearch {
  return {
    q: typeof search.q === 'string' ? search.q : undefined,
    type:
      search.type === 'id' || search.type === 'ip' || search.type === 'name'
        ? search.type
        : undefined,
  }
}

const playersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players',
  validateSearch: validatePlayersSearch,
  component: PlayersPage,
})

const playerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players/$playerId',
  component: PlayerDetailPage,
})

const bannedIpsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/banned-ips',
  component: BannedIpsPage,
})

const auditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/audit',
  component: AuditPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  playersRoute,
  playerDetailRoute,
  bannedIpsRoute,
  auditRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
