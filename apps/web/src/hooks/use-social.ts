import { useCallback, useEffect, useState } from 'react'

import { api } from '#/lib/api'
import type { Friend, FriendRequest } from '#/lib/api'

export function useSocial(token: string | null) {
  const [friendCode, setFriendCode] = useState<string | null>(null)
  const [friends, setFriends] = useState<Array<Friend>>([])
  const [requests, setRequests] = useState<Array<FriendRequest>>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )

  const refresh = useCallback(async () => {
    if (!token) return
    setStatus('loading')
    try {
      const [profile, social] = await Promise.all([
        api.me(token),
        api.friends(token),
      ])
      setFriendCode(profile.friendCode)
      setFriends(social.friends)
      setRequests(social.requests)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const sendRequest = useCallback(
    async (code: string) => {
      if (!token) return false
      try {
        await api.sendFriendRequest(token, code)
        await refresh()
        return true
      } catch {
        return false
      }
    },
    [refresh, token],
  )

  const respond = useCallback(
    async (requestId: number, action: 'accept' | 'decline') => {
      if (!token) return false
      try {
        await api.respondToFriendRequest(token, requestId, action)
        await refresh()
        return true
      } catch {
        return false
      }
    },
    [refresh, token],
  )

  const remove = useCallback(
    async (friendId: string) => {
      if (!token) return false
      try {
        await api.removeFriend(token, friendId)
        await refresh()
        return true
      } catch {
        return false
      }
    },
    [refresh, token],
  )

  const rotateCode = useCallback(async () => {
    if (!token) return false
    try {
      const result = await api.rotateFriendCode(token)
      setFriendCode(result.code)
      return true
    } catch {
      return false
    }
  }, [token])

  return {
    friendCode,
    friends,
    requests,
    status,
    refresh,
    sendRequest,
    respond,
    remove,
    rotateCode,
  }
}
