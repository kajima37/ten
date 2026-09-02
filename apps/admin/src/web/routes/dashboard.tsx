import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { inputClass, buttonClass } from '../components/ui'
import type { SearchType } from '../lib/api'

export function DashboardPage() {
  const navigate = useNavigate()
  const [type, setType] = useState<SearchType>('name')
  const [q, setQ] = useState('')

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold">プレイヤー検索</h1>
        <p className="mt-1 text-sm text-zinc-400">
          プレイヤー ID、表示名、IP ハッシュで検索できます。
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = q.trim()
            if (!trimmed) return
            void navigate({ to: '/players', search: { q: trimmed, type } })
          }}
        >
          <div>
            <label
              className="mb-1 block text-xs font-medium text-zinc-400"
              htmlFor="type"
            >
              検索方法
            </label>
            <select
              id="type"
              className={inputClass}
              value={type}
              onChange={(event) => setType(event.target.value as SearchType)}
            >
              <option value="name">表示名</option>
              <option value="id">プレイヤー ID</option>
              <option value="ip">IP ハッシュ</option>
            </select>
          </div>
          <div className="min-w-64 flex-1">
            <label
              className="mb-1 block text-xs font-medium text-zinc-400"
              htmlFor="q"
            >
              検索語
            </label>
            <input
              id="q"
              className={inputClass}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={
                type === 'name'
                  ? '表示名の一部'
                  : type === 'id'
                    ? 'プレイヤー ID'
                    : 'IP ハッシュ'
              }
            />
          </div>
          <button type="submit" className={buttonClass}>
            検索
          </button>
        </form>
      </section>
    </div>
  )
}
