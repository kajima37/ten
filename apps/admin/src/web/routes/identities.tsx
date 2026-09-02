import { useEffect, useState } from 'react'

import { api, formatDateTime } from '../lib/api'
import type { Identity } from '../lib/api'
import { buttonClass, dangerButtonClass, inputClass } from '../components/ui'

function status(identity: Identity): string {
  if (identity.approvedAt === null) return '保留中'
  return identity.revokedAt === null ? '承認済み' : '取消済み'
}

export function IdentitiesPage() {
  const [identities, setIdentities] = useState<Array<Identity>>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    api
      .identities()
      .then((result) => {
        setIdentities(result.identities)
        setError(null)
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : '読み込みに失敗しました',
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  const change = (identity: Identity, action: 'approve' | 'revoke') => {
    const key = `${identity.provider}:${identity.subject}`
    const reason = (reasons[key] ?? '').trim()
    if (!reason) return
    const request =
      action === 'approve'
        ? api.approveIdentity(identity.provider, identity.subject, reason)
        : api.revokeIdentity(identity.provider, identity.subject, reason)
    request
      .then(() => {
        setMessage(
          `${identity.provider}:${identity.subject} を${action === 'approve' ? '承認' : '取り消し'}ました。`,
        )
        reload()
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : '操作に失敗しました'),
      )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">アクセス管理</h1>
        <p className="mt-1 text-sm text-zinc-400">
          ログインを試みたアカウントを承認または取り消します。すべての変更は監査ログに記録されます。
        </p>
      </div>
      {message && (
        <p className="rounded border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-sm text-zinc-400">読み込み中...</p>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-2">状態</th>
                <th className="py-2">アカウント</th>
                <th className="py-2">表示名 / メール</th>
                <th className="py-2">申請日時</th>
                <th className="py-2">承認者</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {identities.map((identity) => {
                const key = `${identity.provider}:${identity.subject}`
                const active =
                  identity.approvedAt !== null && identity.revokedAt === null
                return (
                  <tr key={key} className="border-t border-zinc-800 align-top">
                    <td className="py-2 whitespace-nowrap">
                      {status(identity)}
                    </td>
                    <td className="py-2 font-mono text-xs break-all">{key}</td>
                    <td className="py-2">
                      <div>{identity.displayName ?? '-'}</div>
                      <div className="text-xs text-zinc-500">
                        {identity.email ?? '-'}
                      </div>
                    </td>
                    <td className="py-2 text-xs text-zinc-400 whitespace-nowrap">
                      {formatDateTime(identity.createdAt)}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {identity.approvedBy ?? '-'}
                    </td>
                    <td className="py-2">
                      <div className="flex min-w-75 items-center gap-2">
                        <input
                          className={`${inputClass} w-40`}
                          placeholder="操作理由"
                          value={reasons[key] ?? ''}
                          onChange={(event) =>
                            setReasons((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className={active ? dangerButtonClass : buttonClass}
                          disabled={!(reasons[key] ?? '').trim()}
                          onClick={() =>
                            change(identity, active ? 'revoke' : 'approve')
                          }
                        >
                          {active ? '取消' : '承認'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {identities.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-zinc-500">
                    ログインを試みたアカウントはありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
