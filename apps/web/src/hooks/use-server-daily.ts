import { useCallback, useEffect, useState } from 'react'

import { api } from '#/lib/api'
import type { DailyPayload, LeaderboardResponse } from '#/lib/api'

export function useDailyBoard() {
  const [daily, setDaily] = useState<DailyPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .daily()
      .then((payload) => {
        if (!cancelled) setDaily(payload)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return daily
}

export function useLeaderboard(dateKey: string | null, token: string | null) {
  const [data, setData] = useState<LeaderboardResponse | null>(null)

  const refresh = useCallback(() => {
    if (!dateKey) return
    void api
      .leaderboard(token, dateKey)
      .then((payload) => setData(payload))
      .catch(() => setData(null))
  }, [dateKey, token])

  useEffect(refresh, [refresh])

  return { data, refresh }
}
