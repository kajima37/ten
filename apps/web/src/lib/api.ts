import type { GameEvent } from '@ten/game-core'

export const API_ENABLED = import.meta.env.MODE !== 'github-pages'

export const API_URL: string =
  !API_ENABLED || import.meta.env.MODE === 'worker'
    ? ''
    : (import.meta.env.VITE_API_URL ?? 'http://localhost:8787')

export type DailyPayload = {
  dateKey: string
  board: Array<number>
}

export type ScoreSubmission = {
  dateKey: string
  startToken: string
  events: Array<GameEvent>
  score: number
  maxCombo: number
}

export type DailyStartPayload = DailyPayload & {
  startToken: string
}

export type ScoreResponse = {
  accepted: boolean
  isNewBest: boolean
  best: number
  rank: number
  topPercent: number
}

export type LeaderboardEntry = {
  rank: number
  playerId: string
  name: string
  score: number
  combo: number
}

export type LeaderboardResponse = {
  date: string
  total: number
  entries: Array<LeaderboardEntry>
  mine: { rank: number; topPercent: number; score: number } | null
}

export type WeeklyLeaderboardEntry = LeaderboardEntry & {
  streak: number
}

export type WeeklyLeaderboardResponse = {
  week: string
  total: number
  entries: Array<WeeklyLeaderboardEntry>
  mine: { rank: number; topPercent: number; score: number } | null
}

export type Friend = {
  id: string
  name: string
  streak: number
}

export type FriendRequest = {
  id: number
  playerId: string
  name: string
  direction: 'incoming' | 'outgoing'
}

export type FriendsResponse = {
  friends: Array<Friend>
  requests: Array<FriendRequest>
}

export type SocialProfile = PlayerProfile & {
  friendCode: string | null
}

export type PlayerProfile = {
  id: string
  name: string
}

export type RegisterResponse = {
  token: string
  player: PlayerProfile
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  if (!API_ENABLED) throw new ApiError(503, 'API is disabled in this build')
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }
  return (await response.json()) as T
}

export const api = {
  register(deviceId: string, name?: string): Promise<RegisterResponse> {
    return request<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ deviceId, name }),
    })
  },

  daily(): Promise<DailyPayload> {
    return request<DailyPayload>('/api/daily')
  },

  startDaily(token: string): Promise<DailyStartPayload> {
    return request<DailyStartPayload>(
      '/api/daily/start',
      { method: 'POST' },
      token,
    )
  },

  submitScore(
    token: string,
    submission: ScoreSubmission,
  ): Promise<ScoreResponse> {
    return request<ScoreResponse>(
      '/api/scores',
      {
        method: 'POST',
        body: JSON.stringify({ mode: 'daily', ...submission }),
      },
      token,
    )
  },

  leaderboard(
    token: string | null,
    date: string,
  ): Promise<LeaderboardResponse> {
    const query = `?date=${encodeURIComponent(date)}`
    return request<LeaderboardResponse>(
      `/api/leaderboard${query}`,
      undefined,
      token,
    )
  },

  weeklyLeaderboard(
    token: string | null,
    week: string,
    scope: 'global' | 'friends',
  ): Promise<WeeklyLeaderboardResponse> {
    const query = new URLSearchParams({ week, scope })
    return request<WeeklyLeaderboardResponse>(
      `/api/leaderboard/weekly?${query.toString()}`,
      undefined,
      token,
    )
  },

  friends(token: string): Promise<FriendsResponse> {
    return request<FriendsResponse>('/api/friends', undefined, token)
  },

  sendFriendRequest(token: string, friendCode: string): Promise<void> {
    return request<void>(
      '/api/friend-requests',
      { method: 'POST', body: JSON.stringify({ friendCode }) },
      token,
    )
  },

  respondToFriendRequest(
    token: string,
    requestId: number,
    action: 'accept' | 'decline',
  ): Promise<void> {
    return request<void>(
      `/api/friend-requests/${requestId}/${action}`,
      { method: 'POST' },
      token,
    )
  },

  removeFriend(token: string, friendId: string): Promise<void> {
    return request<void>(
      `/api/friends/${friendId}`,
      { method: 'DELETE' },
      token,
    )
  },

  rotateFriendCode(
    token: string,
  ): Promise<{ code: string; expiresAt: string }> {
    return request<{ code: string; expiresAt: string }>(
      '/api/me/friend-code',
      { method: 'POST' },
      token,
    )
  },

  me(token: string): Promise<SocialProfile> {
    return request<SocialProfile>('/api/me', undefined, token)
  },

  updateName(token: string, name: string): Promise<PlayerProfile> {
    return request<PlayerProfile>(
      '/api/me',
      {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      },
      token,
    )
  },

  deleteAccount(token: string): Promise<{ deleted: true }> {
    return request<{ deleted: true }>('/api/me', { method: 'DELETE' }, token)
  },

  deletionCode(token: string): Promise<{ deletionCode: string }> {
    return request<{ deletionCode: string }>(
      '/api/me/deletion-code',
      undefined,
      token,
    )
  },
}
