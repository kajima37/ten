import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'

import { api, formatDateTime } from '../lib/api'
import type { IpBan, PlayerDetail } from '../lib/api'
import {
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
} from '../components/ui'

export function PlayerDetailPage() {
  const { playerId } = useParams({ from: '/players/$playerId' })
  const [player, setPlayer] = useState<PlayerDetail | null>(null)
  const [ipBan, setIpBan] = useState<IpBan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    api
      .player(playerId)
      .then((result) => {
        setPlayer(result.player)
        setIpBan(result.ipBan)
        setError(null)
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : '読み込みに失敗しました',
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(reload, [playerId])

  if (loading && !player) {
    return <p className="text-sm text-zinc-400">読み込み中...</p>
  }
  if (error && !player) {
    return <p className="text-sm text-red-400">{error}</p>
  }
  if (!player) return null

  const banned = player.banned === 1

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{player.name}</h1>
          {banned ? (
            <span className="rounded bg-red-600/20 px-2 py-0.5 text-xs font-semibold text-red-400">
              利用停止
              {player.bannedUntil
                ? ` (〜 ${formatDateTime(player.bannedUntil)})`
                : ' (無期限)'}
            </span>
          ) : (
            <span className="rounded bg-zinc-700/40 px-2 py-0.5 text-xs text-zinc-300">
              通常
            </span>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-500">プレイヤー ID</dt>
          <dd className="font-mono text-xs break-all">{player.id}</dd>
          <dt className="text-zinc-500">IP ハッシュ</dt>
          <dd className="font-mono text-xs break-all">
            {player.ipHash ?? '-'}
          </dd>
          <dt className="text-zinc-500">登録日時</dt>
          <dd>{formatDateTime(player.createdAt)}</dd>
        </dl>
      </section>

      {message && (
        <p className="rounded border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {banned ? (
          <UnbanCard
            playerId={player.id}
            onDone={(text) => {
              setMessage(text)
              setError(null)
              reload()
            }}
            onError={(text) => {
              setError(text)
              setMessage(null)
            }}
          />
        ) : (
          <BanCard
            playerId={player.id}
            onDone={(text) => {
              setMessage(text)
              setError(null)
              reload()
            }}
            onError={(text) => {
              setError(text)
              setMessage(null)
            }}
          />
        )}

        <HideCard
          playerId={player.id}
          mode="hide"
          onDone={(text) => {
            setMessage(text)
            setError(null)
            reload()
          }}
          onError={(text) => {
            setError(text)
            setMessage(null)
          }}
        />
        <HideCard
          playerId={player.id}
          mode="unhide"
          onDone={(text) => {
            setMessage(text)
            setError(null)
            reload()
          }}
          onError={(text) => {
            setError(text)
            setMessage(null)
          }}
        />

        {player.ipHash && (
          <IpCard
            ipHash={player.ipHash}
            ipBan={ipBan}
            onDone={(text) => {
              setMessage(text)
              setError(null)
              reload()
            }}
            onError={(text) => {
              setError(text)
              setMessage(null)
            }}
          />
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold">スコア履歴</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-2">日付</th>
              <th className="py-2">スコア</th>
              <th className="py-2">コンボ</th>
              <th className="py-2">記録日時</th>
              <th className="py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {player.scores.map((score) => (
              <tr key={score.dateKey} className="border-t border-zinc-800">
                <td className="py-2">{score.dateKey}</td>
                <td className="py-2">{score.score}</td>
                <td className="py-2">{score.combo}</td>
                <td className="py-2 text-xs text-zinc-400">
                  {formatDateTime(score.createdAt)}
                </td>
                <td className="py-2">
                  {score.hiddenAt ? (
                    <span className="text-zinc-500">
                      非表示 ({formatDateTime(score.hiddenAt)})
                    </span>
                  ) : (
                    <span className="text-zinc-400">表示中</span>
                  )}
                </td>
              </tr>
            ))}
            {player.scores.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-sm text-zinc-500">
                  スコアはありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

type CardProps = {
  playerId: string
  onDone: (message: string) => void
  onError: (message: string) => void
}

function BanCard({ playerId, onDone, onError }: CardProps) {
  const [reason, setReason] = useState('')
  const [until, setUntil] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <section className="rounded-lg border border-zinc-800 p-4">
      <h2 className="font-semibold">利用停止</h2>
      <p className="mt-1 text-xs text-zinc-400">
        期限を空にすると無期限の停止になります。
      </p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          api
            .banPlayer(playerId, {
              reason: reason.trim(),
              ...(until ? { until: new Date(until).toISOString() } : {}),
            })
            .then(() => {
              setReason('')
              setUntil('')
              onDone('プレイヤーを利用停止にしました。')
            })
            .catch((cause: unknown) =>
              onError(
                cause instanceof Error ? cause.message : '操作に失敗しました',
              ),
            )
            .finally(() => setBusy(false))
        }}
      >
        <div>
          <label className={labelClass} htmlFor="ban-reason">
            理由 (必須・監査ログに記録)
          </label>
          <input
            id="ban-reason"
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ban-until">
            停止期限 (任意)
          </label>
          <input
            id="ban-until"
            type="datetime-local"
            className={inputClass}
            value={until}
            onChange={(event) => setUntil(event.target.value)}
          />
        </div>
        <button type="submit" className={dangerButtonClass} disabled={busy}>
          利用停止にする
        </button>
      </form>
    </section>
  )
}

function UnbanCard({ playerId, onDone, onError }: CardProps) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <section className="rounded-lg border border-zinc-800 p-4">
      <h2 className="font-semibold">利用停止の解除</h2>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          api
            .unbanPlayer(playerId, { reason: reason.trim() })
            .then(() => {
              setReason('')
              onDone('利用停止を解除しました。')
            })
            .catch((cause: unknown) =>
              onError(
                cause instanceof Error ? cause.message : '操作に失敗しました',
              ),
            )
            .finally(() => setBusy(false))
        }}
      >
        <div>
          <label className={labelClass} htmlFor="unban-reason">
            理由 (必須・監査ログに記録)
          </label>
          <input
            id="unban-reason"
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </div>
        <button type="submit" className={buttonClass} disabled={busy}>
          解除する
        </button>
      </form>
    </section>
  )
}

type HideCardProps = CardProps & { mode: 'hide' | 'unhide' }

function HideCard({ playerId, mode, onDone, onError }: HideCardProps) {
  const hiding = mode === 'hide'
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const confirmWord = 'ALL'

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const call = hiding
      ? api.hideScores(playerId, {
          reason: reason.trim(),
          ...(date ? { date } : {}),
        })
      : api.unhideScores(playerId, {
          reason: reason.trim(),
          ...(date ? { date } : {}),
        })
    call
      .then((result) => {
        setReason('')
        setDate('')
        setConfirm('')
        onDone(
          `対象 ${'hidden' in result ? result.hidden : result.restored} 件のスコアを${
            hiding ? '非表示にしました。' : '再表示しました。'
          }`,
        )
      })
      .catch((cause: unknown) =>
        onError(cause instanceof Error ? cause.message : '操作に失敗しました'),
      )
      .finally(() => setBusy(false))
  }

  return (
    <section className="rounded-lg border border-zinc-800 p-4">
      <h2 className="font-semibold">
        {hiding ? 'スコアを非表示にする' : 'スコアを再表示する'}
      </h2>
      <p className="mt-1 text-xs text-zinc-400">
        {hiding
          ? 'スコアは削除されず、ランキングから除外されます。'
          : '非表示にしたスコアをランキングに戻します。'}
      </p>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        <div>
          <label className={labelClass} htmlFor={`${mode}-reason`}>
            理由 (必須・監査ログに記録)
          </label>
          <input
            id={`${mode}-reason`}
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${mode}-date`}>
            対象日 (YYYY-MM-DD、空なら全期間)
          </label>
          <input
            id={`${mode}-date`}
            className={inputClass}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            placeholder="2026-09-01"
          />
        </div>
        {!date && (
          <div>
            <label className={labelClass} htmlFor={`${mode}-confirm`}>
              全期間が対象です。確認のため「{confirmWord}」と入力してください
            </label>
            <input
              id={`${mode}-confirm`}
              className={inputClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>
        )}
        <button
          type="submit"
          className={hiding ? dangerButtonClass : buttonClass}
          disabled={busy || (!date && confirm !== confirmWord)}
        >
          {hiding ? '非表示にする' : '再表示する'}
        </button>
      </form>
    </section>
  )
}

type IpCardProps = {
  ipHash: string
  ipBan: IpBan | null
  onDone: (message: string) => void
  onError: (message: string) => void
}

function IpCard({ ipHash, ipBan, onDone, onError }: IpCardProps) {
  const [reason, setReason] = useState('')
  const [until, setUntil] = useState('')
  const [confirm, setConfirm] = useState('')
  const [unbanReason, setUnbanReason] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <section className="rounded-lg border border-zinc-800 p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">IP 単位の停止</h2>
        <Link
          to="/players"
          search={{ q: ipHash, type: 'ip' }}
          className="text-xs text-sky-400 hover:underline"
        >
          同一 IP のアカウントを検索
        </Link>
      </div>
      <p className="mt-1 font-mono text-xs break-all text-zinc-400">{ipHash}</p>
      {ipBan ? (
        <p className="mt-2 text-sm">
          <span className="text-red-400">停止中</span>
          {ipBan.expiresAt
            ? ` (〜 ${formatDateTime(ipBan.expiresAt)})`
            : ' (無期限)'}
          {ipBan.reason ? ` — 理由: ${ipBan.reason}` : ''}
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-400">
          この IP は停止されていません。
        </p>
      )}
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            api
              .banIp(ipHash, {
                reason: reason.trim(),
                ...(until ? { until: new Date(until).toISOString() } : {}),
              })
              .then((result) => {
                setReason('')
                setUntil('')
                setConfirm('')
                onDone(
                  `IP を停止しました。既存アカウント ${result.affected} 件を停止、今後の登録・利用も拒否されます。`,
                )
              })
              .catch((cause: unknown) =>
                onError(
                  cause instanceof Error ? cause.message : '操作に失敗しました',
                ),
              )
              .finally(() => setBusy(false))
          }}
        >
          <div>
            <label className={labelClass} htmlFor="ip-ban-reason">
              理由 (必須・監査ログに記録)
            </label>
            <input
              id="ip-ban-reason"
              className={inputClass}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ip-ban-until">
              停止期限 (任意、空なら無期限)
            </label>
            <input
              id="ip-ban-until"
              type="datetime-local"
              className={inputClass}
              value={until}
              onChange={(event) => setUntil(event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ip-ban-confirm">
              影響が大きい操作です。確認のため「BAN-IP」と入力してください
            </label>
            <input
              id="ip-ban-confirm"
              className={inputClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className={dangerButtonClass}
            disabled={busy || confirm !== 'BAN-IP'}
          >
            この IP を停止する
          </button>
        </form>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            api
              .unbanIp(ipHash, { reason: unbanReason.trim() })
              .then(() => {
                setUnbanReason('')
                onDone(
                  'IP 停止を解除しました。個別に停止されたアカウントは解除されません。',
                )
              })
              .catch((cause: unknown) =>
                onError(
                  cause instanceof Error ? cause.message : '操作に失敗しました',
                ),
              )
              .finally(() => setBusy(false))
          }}
        >
          <div>
            <label className={labelClass} htmlFor="ip-unban-reason">
              解除の理由 (必須・監査ログに記録)
            </label>
            <input
              id="ip-unban-reason"
              className={inputClass}
              value={unbanReason}
              onChange={(event) => setUnbanReason(event.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className={buttonClass}
            disabled={busy || !ipBan}
          >
            この IP の停止を解除する
          </button>
          <p className="text-xs text-zinc-500">
            解除後も、個別に停止されたアカウントは停止されたままです。必要なら各アカウントを個別に解除してください。
          </p>
        </form>
      </div>
    </section>
  )
}
