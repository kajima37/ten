import { useCallback, useEffect, useState } from 'react'

import { api } from '#/lib/api'
import type {
  DailyPayload,
  LeaderboardResponse,
  WeeklyLeaderboardResponse,
} from '#/lib/api'

export function useDailyBoard() {
  const [daily, setDaily] = useState<DailyPayload | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const refresh = useCallback(() => {
    setStatus('loading')
    return api
      .daily()
      .then((payload) => {
        setDaily(payload)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data: daily, status, refresh }
}

export function useLeaderboard(dateKey: string | null, token: string | null) {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )

  const refresh = useCallback(() => {
    if (!dateKey) return
    setStatus('loading')
    void api
      .leaderboard(token, dateKey)
      .then((payload) => {
        setData(payload)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [dateKey, token])

  useEffect(refresh, [refresh])

  return { data, status, refresh }
}

export function useWeeklyLeaderboard(
  week: string,
  scope: 'global' | 'friends',
  token: string | null,
) {
  const [data, setData] = useState<WeeklyLeaderboardResponse | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )

  const refresh = useCallback(() => {
    if (scope === 'friends' && !token) return
    setStatus('loading')
    void api
      .weeklyLeaderboard(token, week, scope)
      .then((payload) => {
        setData(payload)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [scope, token, week])

  useEffect(refresh, [refresh])
  return { data, status, refresh }
}
