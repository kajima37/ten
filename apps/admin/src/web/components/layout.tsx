import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { api } from '../lib/api'
import type { Me } from '../lib/api'

type MeState =
  { kind: 'loading' } | { kind: 'unauthorized' } | { kind: 'ready'; me: Me }

export function Layout({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MeState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then((me) => {
        if (!cancelled) setState({ kind: 'ready', me })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'unauthorized' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind !== 'ready') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        {state.kind === 'loading' ? (
          <p className="text-sm text-zinc-400">読み込み中...</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold">TEN. 管理画面</h1>
            <p className="text-sm text-zinc-400">
              管理者アカウントでログインしてください。
            </p>
            <a
              href="/auth/login"
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            >
              ログイン
            </a>
          </>
        )}
      </main>
    )
  }

  const me = state.me
  const production = me.environment === 'production'

  return (
    <div className="min-h-screen">
      {production && (
        <div className="bg-red-700 px-4 py-1.5 text-center text-xs font-semibold tracking-wide">
          本番環境 (PRODUCTION) — 操作内容は監査ログに記録されます
        </div>
      )}
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            TEN. admin
          </Link>
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              production
                ? 'bg-red-600/20 text-red-400'
                : 'bg-sky-600/20 text-sky-400'
            }`}
          >
            {production ? 'PRODUCTION' : 'STAGING'}
          </span>
          <span className="text-xs text-zinc-500">
            {me.provider}:{me.subject}
          </span>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link
              to="/players"
              className="text-zinc-300 hover:text-white"
              activeProps={{ className: 'text-white font-medium' }}
            >
              プレイヤー
            </Link>
            <Link
              to="/banned-ips"
              className="text-zinc-300 hover:text-white"
              activeProps={{ className: 'text-white font-medium' }}
            >
              IP 停止
            </Link>
            <Link
              to="/identities"
              className="text-zinc-300 hover:text-white"
              activeProps={{ className: 'text-white font-medium' }}
            >
              アクセス管理
            </Link>
            <Link
              to="/audit"
              className="text-zinc-300 hover:text-white"
              activeProps={{ className: 'text-white font-medium' }}
            >
              監査ログ
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}

function LogoutButton() {
  return (
    <button
      type="button"
      className="text-zinc-400 hover:text-white"
      onClick={() => {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = '/auth/logout'
        document.body.appendChild(form)
        form.submit()
      }}
    >
      ログアウト
    </button>
  )
}
