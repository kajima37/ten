import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { authenticatedRequest } from '#/lib/authenticated-request'

describe('authenticatedRequest', () => {
  it('re-registers and retries once after an unauthorized response', async () => {
    const tokens = ['expired-token', 'fresh-token']
    let sessionIndex = 0
    let clearCount = 0
    const requestedTokens: Array<string> = []

    const response = await authenticatedRequest({
      getSession: async () => ({ token: tokens[sessionIndex] }),
      clearSession: () => {
        clearCount += 1
        sessionIndex += 1
      },
      request: async (token) => {
        requestedTokens.push(token)
        if (token === 'expired-token') throw { status: 401 }
        return 'accepted'
      },
    })

    assert.ok(response)
    assert.equal(response.result, 'accepted')
    assert.equal(response.session.token, 'fresh-token')
    assert.equal(clearCount, 1)
    assert.deepEqual(requestedTokens, ['expired-token', 'fresh-token'])
  })

  it('does not clear the session for non-authentication errors', async () => {
    let cleared = false

    await assert.rejects(
      authenticatedRequest({
        getSession: async () => ({ token: 'valid-token' }),
        clearSession: () => {
          cleared = true
        },
        request: async () => {
          throw new Error('server error')
        },
      }),
      /server error/,
    )

    assert.equal(cleared, false)
  })

  it('returns null when a new session cannot be created', async () => {
    const response = await authenticatedRequest({
      getSession: async () => null,
      clearSession: () => undefined,
      request: async () => 'unused',
    })

    assert.equal(response, null)
  })
})
