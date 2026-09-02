import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'

import { api, formatDateTime } from '../lib/api'
import type { PlayerSummary, SearchType } from '../lib/api'

export function PlayersPage() {
  const search = useSearch({ from: '/players' })
  const navigate = useNavigate()
  const [type, setType] = useState<SearchType>(search.type ?? 'name')
  const [q, setQ] = useState(search.q ?? '')
  const [players, setPlayers] = useState<Array<PlayerSummary>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!search.q) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .searchPlayers(search.type ?? 'name', search.q)
      .then((result) => {
        if (!cancelled) setPlayers(result.players)
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : '検索に失敗しました',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search.q, search.type])

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-2"
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
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          検索
        </button>
      </form>

      {loading && <p className="text-sm text-zinc-400">検索中...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && search.q && !error && (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-2">ID</th>
              <th className="py-2">名前</th>
              <th className="py-2">状態</th>
              <th className="py-2">スコア件数</th>
              <th className="py-2">非表示</th>
              <th className="py-2">登録日時</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-t border-zinc-800">
                <td className="py-2">
                  <Link
                    to="/players/$playerId"
                    params={{ playerId: player.id }}
                    className="font-mono text-xs text-sky-400 hover:underline"
                  >
                    {player.id.slice(0, 8)}...
                  </Link>
                </td>
                <td className="py-2">{player.name}</td>
                <td className="py-2">
                  {player.banned ? (
                    <span className="text-red-400">
                      停止
                      {player.bannedUntil
                        ? ` (〜 ${formatDateTime(player.bannedUntil)})`
                        : ' (無期限)'}
                    </span>
                  ) : (
                    <span className="text-zinc-400">通常</span>
                  )}
                </td>
                <td className="py-2">{player.scoreCount}</td>
                <td className="py-2">{player.hiddenCount}</td>
                <td className="py-2 text-xs text-zinc-400">
                  {formatDateTime(player.createdAt)}
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-sm text-zinc-500">
                  該当するプレイヤーが見つかりませんでした。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
