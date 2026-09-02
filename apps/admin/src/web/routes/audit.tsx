import { useEffect, useState } from 'react'

import { api, formatDateTime } from '../lib/api'
import type { AuditRow } from '../lib/api'
import { buttonClass } from '../components/ui'

const PAGE_SIZE = 50

export function AuditPage() {
  const [logs, setLogs] = useState<Array<AuditRow>>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .audit(PAGE_SIZE, offset)
      .then((result) => {
        if (!cancelled) {
          setLogs(result.logs)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : '読み込みに失敗しました',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [offset])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">監査ログ</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={offset === 0 || loading}
            onClick={() =>
              setOffset((current) => Math.max(0, current - PAGE_SIZE))
            }
          >
            前へ
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={loading || logs.length < PAGE_SIZE}
            onClick={() => setOffset((current) => current + PAGE_SIZE)}
          >
            次へ
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-sm text-zinc-400">読み込み中...</p>}
      {!loading && !error && (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-2">日時</th>
              <th className="py-2">実行者</th>
              <th className="py-2">操作</th>
              <th className="py-2">対象</th>
              <th className="py-2">理由</th>
              <th className="py-2">件数</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-zinc-800 align-top">
                <td className="py-2 text-xs whitespace-nowrap text-zinc-400">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="py-2 font-mono text-xs">
                  {log.actorProvider}:{log.actorSubject}
                </td>
                <td className="py-2">{log.action}</td>
                <td className="py-2">
                  <span className="text-zinc-500">{log.targetType}</span>{' '}
                  <span className="font-mono text-xs break-all">
                    {log.targetId}
                  </span>
                </td>
                <td className="py-2">{log.reason ?? '-'}</td>
                <td className="py-2">{log.affectedCount ?? '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-sm text-zinc-500">
                  記録はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
