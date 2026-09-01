import type { GameEvent } from '@ten/game-core'

export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export type DailyPayload = {
  dateKey: string
  board: Array<number>
}

export type ScoreSubmission = {
  dateKey: string
  events: Array<GameEvent>
  score: number
  maxCombo: number
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
}
