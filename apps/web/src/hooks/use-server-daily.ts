import { useCallback, useEffect, useState } from 'react'

import { API_ENABLED, api } from '#/lib/api'
import type {
  DailyPayload,
  LeaderboardResponse,
  WeeklyLeaderboardResponse,
} from '#/lib/api'
import { createDailyRandom, makeBoard } from '@ten/game-core'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function getJstDateKey(date = new Date()): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

function getLocalDaily(): DailyPayload {
  const dateKey = getJstDateKey()
  return { dateKey, board: makeBoard(createDailyRandom(dateKey)) }
}

export function useDailyBoard() {
  const [daily, setDaily] = useState<DailyPayload | null>(() =>
    API_ENABLED ? null : getLocalDaily(),
  )
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(() =>
    API_ENABLED ? 'loading' : 'ready',
  )

  const refresh = useCallback(() => {
    if (!API_ENABLED) {
      setDaily(getLocalDaily())
      setStatus('ready')
      return Promise.resolve()
    }
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
    if (!API_ENABLED) return
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
    if (!API_ENABLED) return
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
