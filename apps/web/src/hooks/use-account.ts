import { useCallback, useEffect, useState } from 'react'

import { api } from '#/lib/api'
import type { PlayerProfile, ScoreResponse, ScoreSubmission } from '#/lib/api'
import {
  STORAGE_KEYS,
  readJson,
  readStorage,
  writeJson,
  writeStorage,
} from '#/lib/storage'

function getDeviceId(): string {
  const existing = readStorage(STORAGE_KEYS.deviceId)
  if (existing) return existing
  const generated = crypto.randomUUID()
  writeStorage(STORAGE_KEYS.deviceId, generated)
  return generated
}

async function ensureToken(): Promise<string | null> {
  const existing = readStorage(STORAGE_KEYS.token)
  if (existing) return existing
  try {
    const response = await api.register(getDeviceId())
    writeStorage(STORAGE_KEYS.token, response.token)
    writeJson(STORAGE_KEYS.playerProfile, response.player)
    return response.token
  } catch {
    return null
  }
}

export function useAccount() {
  const [token, setToken] = useState<string | null>(() =>
    readStorage(STORAGE_KEYS.token),
  )
  const [player, setPlayer] = useState<PlayerProfile | null>(() =>
    readJson<PlayerProfile>(STORAGE_KEYS.playerProfile),
  )

  useEffect(() => {
    let cancelled = false
    void ensureToken().then((value) => {
      if (cancelled || !value) return
      setToken(value)
      setPlayer(
        (current) =>
          current ?? readJson<PlayerProfile>(STORAGE_KEYS.playerProfile),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  const submitScore = useCallback(
    async (submission: ScoreSubmission): Promise<ScoreResponse | null> => {
      const value = await ensureToken()
      if (!value) return null
      try {
        return await api.submitScore(value, submission)
      } catch {
        return null
      }
    },
    [],
  )

  const updateName = useCallback(async (name: string): Promise<boolean> => {
    const value = await ensureToken()
    if (!value) return false
    try {
      const profile = await api.updateName(value, name)
      writeJson(STORAGE_KEYS.playerProfile, profile)
      setPlayer(profile)
      return true
    } catch {
      return false
    }
  }, [])

  return { token, player, submitScore, updateName }
}
