import { useCallback, useEffect, useState } from 'react'

import { api } from '#/lib/api'
import type {
  PlayerProfile,
  RegisterResponse,
  ScoreResponse,
  ScoreSubmission,
} from '#/lib/api'
import { authenticatedRequest } from '#/lib/authenticated-request'
import {
  STORAGE_KEYS,
  readJson,
  readStorage,
  removeStorage,
  writeJson,
  writeStorage,
} from '#/lib/storage'

let registrationPromise: Promise<RegisterResponse | null> | null = null

function getDeviceId(): string {
  const existing = readStorage(STORAGE_KEYS.deviceId)
  if (existing) return existing
  const generated = crypto.randomUUID()
  writeStorage(STORAGE_KEYS.deviceId, generated)
  return generated
}

async function ensureSession(): Promise<RegisterResponse | null> {
  const token = readStorage(STORAGE_KEYS.token)
  const player = readJson<PlayerProfile>(STORAGE_KEYS.playerProfile)
  if (token && player) return { token, player }

  registrationPromise ??= api
    .register(getDeviceId())
    .then((response) => {
      writeStorage(STORAGE_KEYS.token, response.token)
      writeJson(STORAGE_KEYS.playerProfile, response.player)
      return response
    })
    .catch(() => null)
    .finally(() => {
      registrationPromise = null
    })

  return registrationPromise
}

function clearSession() {
  removeStorage(STORAGE_KEYS.token)
  removeStorage(STORAGE_KEYS.playerProfile)
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
    void ensureSession().then((session) => {
      if (cancelled || !session) return
      setToken(session.token)
      setPlayer(session.player)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const submitScore = useCallback(
    async (submission: ScoreSubmission): Promise<ScoreResponse | null> => {
      try {
        const response = await authenticatedRequest({
          getSession: ensureSession,
          clearSession,
          request: (value) => api.submitScore(value, submission),
        })
        if (!response) return null
        setToken(response.session.token)
        setPlayer(response.session.player)
        return response.result
      } catch {
        return null
      }
    },
    [],
  )

  const updateName = useCallback(async (name: string): Promise<boolean> => {
    try {
      const response = await authenticatedRequest({
        getSession: ensureSession,
        clearSession,
        request: (value) => api.updateName(value, name),
      })
      if (!response) return false
      const profile = response.result
      writeJson(STORAGE_KEYS.playerProfile, profile)
      setToken(response.session.token)
      setPlayer(profile)
      return true
    } catch {
      return false
    }
  }, [])

  return { token, player, submitScore, updateName }
}
