import { useCallback, useEffect, useState } from 'react'

import { API_ENABLED, api } from '#/lib/api'
import type {
  PlayerProfile,
  DailyStartPayload,
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
  if (!API_ENABLED) return null
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
    API_ENABLED ? readStorage(STORAGE_KEYS.token) : null,
  )
  const [player, setPlayer] = useState<PlayerProfile | null>(() =>
    API_ENABLED
      ? readJson<PlayerProfile>(STORAGE_KEYS.playerProfile)
      : { id: 'local-player', name: 'Player' },
  )

  useEffect(() => {
    if (!API_ENABLED) return
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
      if (!API_ENABLED) return null
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
    if (!API_ENABLED) {
      const profile = { id: 'local-player', name }
      writeJson(STORAGE_KEYS.playerProfile, profile)
      setPlayer(profile)
      return true
    }
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

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    if (!API_ENABLED) return false
    try {
      const response = await authenticatedRequest({
        getSession: ensureSession,
        clearSession,
        request: (value) => api.deleteAccount(value),
      })
      if (!response) return false
      clearSession()
      removeStorage(STORAGE_KEYS.deviceId)
      setToken(null)
      setPlayer(null)
      return true
    } catch {
      return false
    }
  }, [])

  const createDeletionLink = useCallback(async (): Promise<string | null> => {
    if (!API_ENABLED) return null
    try {
      const response = await authenticatedRequest({
        getSession: ensureSession,
        clearSession,
        request: (value) => api.deletionCode(value),
      })
      if (!response) return null
      return `${window.location.origin}/account-deletion?code=${encodeURIComponent(response.result.deletionCode)}`
    } catch {
      return null
    }
  }, [])

  const startDaily =
    useCallback(async (): Promise<DailyStartPayload | null> => {
      if (!API_ENABLED) return null
      try {
        const response = await authenticatedRequest({
          getSession: ensureSession,
          clearSession,
          request: (value) => api.startDaily(value),
        })
        if (!response) return null
        setToken(response.session.token)
        setPlayer(response.session.player)
        return response.result
      } catch {
        return null
      }
    }, [])

  return {
    token,
    player,
    submitScore,
    updateName,
    deleteAccount,
    createDeletionLink,
    startDaily,
  }
}
