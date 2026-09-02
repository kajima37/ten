import { useEffect, useState } from 'react'

import { api, formatDateTime } from '../lib/api'
import type { IpBan } from '../lib/api'
import { buttonClass, inputClass } from '../components/ui'

export function BannedIpsPage() {
  const [ips, setIps] = useState<Array<IpBan>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const reload = () => {
    setLoading(true)
    api
      .bannedIps()
      .then((result) => {
        setIps(result.ips)
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

  const unban = (ipHash: string) => {
    const reason = (reasons[ipHash] ?? '').trim()
    if (!reason) return
    api
      .unbanIp(ipHash, { reason })
      .then(() => {
        setMessage(
          `${ipHash.slice(0, 12)}... の停止を解除しました。個別に停止されたアカウントは解除されません。`,
        )
        setError(null)
        reload()
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : '操作に失敗しました'),
      )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">IP 停止一覧</h1>
      {message && (
        <p className="rounded border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-sm text-zinc-400">読み込み中...</p>}
      {!loading && !error && (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-2">IP ハッシュ</th>
              <th className="py-2">理由</th>
              <th className="py-2">実行者</th>
              <th className="py-2">期限</th>
              <th className="py-2">更新日時</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {ips.map((ip) => (
              <tr key={ip.ipHash} className="border-t border-zinc-800">
                <td className="py-2 font-mono text-xs break-all">
                  {ip.ipHash}
                </td>
                <td className="py-2">{ip.reason ?? '-'}</td>
                <td className="py-2 font-mono text-xs">{ip.bannedBy ?? '-'}</td>
                <td className="py-2">
                  {ip.expiresAt ? formatDateTime(ip.expiresAt) : '無期限'}
                </td>
                <td className="py-2 text-xs text-zinc-400">
                  {formatDateTime(ip.updatedAt)}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <input
                      className={`${inputClass} w-40`}
                      placeholder="解除の理由"
                      value={reasons[ip.ipHash] ?? ''}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [ip.ipHash]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => unban(ip.ipHash)}
                      disabled={!(reasons[ip.ipHash] ?? '').trim()}
                    >
                      解除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {ips.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-sm text-zinc-500">
                  停止中の IP はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
