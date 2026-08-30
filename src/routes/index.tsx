import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'

import { Button } from '#/components/ui/button'

const GameBoard = lazy(() => import('#/components/game-board'))

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4 py-6 sm:justify-center">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.24em] text-muted-foreground">
            MAKE 10. BEAT YOUR BEST.
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-[0.12em]">TEN.</h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground">
            TIME
          </p>
          <p className="text-2xl font-bold tabular-nums">60.0</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-[1.75rem] border bg-card p-3 shadow-2xl shadow-black/50">
        <ClientOnly
          fallback={
            <div className="aspect-square animate-pulse rounded-2xl bg-secondary" />
          }
        >
          <GameBoard />
        </ClientOnly>
      </section>

      <div className="mt-4 rounded-2xl border bg-card px-5 py-4 text-center">
        <span className="text-sm text-muted-foreground">合計 </span>
        <strong className="text-xl">0</strong>
        <span className="text-sm text-muted-foreground"> → あと </span>
        <strong className="text-xl text-accent">10</strong>
      </div>

      <Button className="mt-4 h-12 rounded-full text-base font-bold">
        PLAY
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        PixiJS game surface · TanStack Start scaffold
      </p>
    </main>
  )
}
