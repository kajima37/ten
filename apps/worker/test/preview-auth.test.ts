import assert from 'node:assert/strict'
import test from 'node:test'

import worker from '../src/index.ts'
import { handlePreviewAuth } from '../src/preview-auth.ts'

const env = {
  DB: {} as D1Database,
  PREVIEW_SESSION_SECRET: 'preview-session-secret',
  PREVIEW_HEALTHCHECK_SECRET: 'preview-healthcheck-secret',
  GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  GITHUB_OAUTH_CLIENT_ID: 'github-client-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'github-client-secret',
}

test('preview login page is shown before authentication', async () => {
  const response = await handlePreviewAuth(
    new Request('https://example.workers.dev/'),
    env,
  )
  assert.equal(response?.status, 200)
  assert.match(await response.text(), /Google でログイン/)
})

test('Google login uses PKCE and a secure state cookie', async () => {
  const response = await handlePreviewAuth(
    new Request('https://example.workers.dev/auth/login/google'),
    env,
  )
  assert.equal(response?.status, 302)
  const location = new URL(response.headers.get('location') ?? '')
  assert.equal(location.origin, 'https://accounts.google.com')
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  assert.ok(location.searchParams.get('nonce'))
  assert.match(
    response.headers.get('set-cookie') ?? '',
    /__Host-ten-preview-oauth-google=.*HttpOnly.*Secure.*SameSite=Lax/,
  )
})

test('health checks require the dedicated preview secret', async () => {
  const allowed = await handlePreviewAuth(
    new Request('https://example.workers.dev/api/health', {
      headers: { authorization: 'Bearer preview-healthcheck-secret' },
    }),
    env,
  )
  assert.equal(allowed, null)

  const denied = await handlePreviewAuth(
    new Request('https://example.workers.dev/api/health'),
    env,
  )
  assert.equal(denied?.status, 200)
})

test('preview assets are not served before authentication', async () => {
  const response = await worker.fetch(
    new Request('https://example.workers.dev/'),
    {
      ...env,
      ADMIN_SECRET: 'admin-secret',
      AUTH_SECRET: 'auth-secret',
      DAILY_CACHE: {} as KVNamespace,
      PREVIEW_ENABLED: 'true',
      ASSETS: {
        fetch: async () => new Response('asset'),
      } as unknown as Fetcher,
    },
  )
  assert.equal(response.status, 200)
  assert.match(await response.text(), /Google でログイン/)
})
