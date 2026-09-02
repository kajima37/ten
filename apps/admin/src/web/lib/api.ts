export type AdminEnvironment = 'staging' | 'production'

export type Me = {
  provider: string
  subject: string
  environment: AdminEnvironment
}

export type PlayerSummary = {
  id: string
  name: string
  ipHash: string | null
  banned: number
  bannedUntil: string | null
  createdAt: string
  scoreCount: number
  hiddenCount: number
}

export type ScoreRow = {
  dateKey: string
  score: number
  combo: number
  createdAt: string
  hiddenAt: string | null
}

export type PlayerDetail = {
  id: string
  name: string
  ipHash: string | null
  banned: number
  bannedUntil: string | null
  createdAt: string
  scores: Array<ScoreRow>
}

export type IpBan = {
  ipHash: string
  reason: string | null
  bannedBy: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type AuditRow = {
  id: number
  actorProvider: string
  actorSubject: string
  action: string
  targetType: string
  targetId: string
  reason: string | null
  beforeJson: string | null
  afterJson: string | null
  affectedCount: number | null
  createdAt: string
}

export type Identity = {
  provider: string
  subject: string
  email: string | null
  displayName: string | null
  approvedAt: string | null
  approvedBy: string | null
  revokedAt: string | null
  createdAt: string
  lastSeenAt: string | null
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class UnauthorizedError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (response.status === 401) throw new UnauthorizedError()
  if (!response.ok) {
    const message = await response
      .json()
      .then((data: unknown) =>
        typeof data === 'object' && data !== null && 'error' in data
          ? String(data.error)
          : `エラー (${response.status})`,
      )
      .catch(() => `エラー (${response.status})`)
    throw new ApiError(response.status, message)
  }
  return response.json()
}

export type SearchType = 'name' | 'id' | 'ip'

export const api = {
  me: () => request<Me>('/me'),
  searchPlayers: (type: SearchType, q: string, limit = 20) => {
    const search = new URLSearchParams()
    if (type === 'id') search.set('playerId', q)
    else if (type === 'ip') search.set('ipHash', q)
    else search.set('name', q)
    search.set('limit', String(limit))
    return request<{ players: Array<PlayerSummary> }>(
      `/players?${search.toString()}`,
    )
  },
  player: (id: string) =>
    request<{ player: PlayerDetail; ipBan: IpBan | null }>(
      `/players/${encodeURIComponent(id)}`,
    ),
  banPlayer: (id: string, body: { reason: string; until?: string }) =>
    request<{ id: string; banned: number; bannedUntil: string | null }>(
      `/players/${encodeURIComponent(id)}/ban`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  unbanPlayer: (id: string, body: { reason: string }) =>
    request<{ id: string; banned: number }>(
      `/players/${encodeURIComponent(id)}/unban`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  hideScores: (id: string, body: { reason: string; date?: string }) =>
    request<{ id: string; date: string | null; hidden: number }>(
      `/players/${encodeURIComponent(id)}/scores/hide`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  unhideScores: (id: string, body: { reason: string; date?: string }) =>
    request<{ id: string; date: string | null; restored: number }>(
      `/players/${encodeURIComponent(id)}/scores/unhide`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  banIp: (ipHash: string, body: { reason: string; until?: string }) =>
    request<{
      ipHash: string
      banned: number
      bannedUntil: string | null
      affected: number
      knownAccounts: number
    }>(`/ip/${encodeURIComponent(ipHash)}/ban`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  unbanIp: (ipHash: string, body: { reason: string }) =>
    request<{ ipHash: string; banned: number }>(
      `/ip/${encodeURIComponent(ipHash)}/unban`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  bannedIps: () => request<{ ips: Array<IpBan> }>('/banned-ips'),
  identities: () => request<{ identities: Array<Identity> }>('/identities'),
  approveIdentity: (provider: string, subject: string, reason: string) =>
    request<{ provider: string; subject: string; approved: boolean }>(
      `/identities/${encodeURIComponent(provider)}/${encodeURIComponent(subject)}/approve`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  revokeIdentity: (provider: string, subject: string, reason: string) =>
    request<{ provider: string; subject: string; revoked: boolean }>(
      `/identities/${encodeURIComponent(provider)}/${encodeURIComponent(subject)}/revoke`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  audit: (limit = 50, offset = 0) =>
    request<{ logs: Array<AuditRow> }>(
      `/audit?limit=${limit}&offset=${offset}`,
    ),
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}
