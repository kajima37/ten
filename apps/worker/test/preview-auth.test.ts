import assert from 'node:assert/strict'
import { before, test } from 'node:test'

import { exportJWK, generateKeyPair, SignJWT } from 'jose'

import worker from '../src/index.ts'
import type { Env } from '../src/index.ts'
import { handlePreviewAuth } from '../src/preview-auth.ts'
import type { PreviewAuthConfig } from '../src/env.ts'

const SESSION_COOKIE = '__Host-ten-preview-session'
const OAUTH_COOKIE = '__Host-ten-preview-oauth-'

type IdentityRow = {
  provider: string
  subject: string
  email: string | null
  displayName: string | null
  approvedAt: string | null
  approvedBy: string | null
  revokedAt: string | null
  lastSeenAt: string | null
  createdAt: string
}

type SessionRow = {
  id: string
  provider: string
  subject: string
  expiresAt: string
  revokedAt: string | null
  createdAt: string
}

type TransactionRow = {
  id: string
  provider: string
  state: string
  verifier: string
  nonce: string | null
  expiresAt: string
  consumedAt: string | null
  createdAt: string
}

type PreviewDb = D1Database & {
  identities: Map<string, IdentityRow>
  sessions: Map<string, SessionRow>
  transactions: Map<string, TransactionRow>
}

const FIXED_NOW = '2026-09-02T00:00:00.000Z'

function createPreviewDb(
  seed: {
    identities?: Array<
      Partial<IdentityRow> & { provider: string; subject: string }
    >
    sessions?: Array<Partial<SessionRow> & { id: string }>
  } = {},
): PreviewDb {
  const identities = new Map<string, IdentityRow>()
  const sessions = new Map<string, SessionRow>()
  const transactions = new Map<string, TransactionRow>()
  const key = (provider: string, subject: string) => `${provider}:${subject}`
  for (const item of seed.identities ?? []) {
    identities.set(key(item.provider, item.subject), {
      email: null,
      displayName: null,
      approvedAt: null,
      approvedBy: null,
      revokedAt: null,
      lastSeenAt: null,
      createdAt: FIXED_NOW,
      ...item,
    })
  }
  for (const item of seed.sessions ?? []) {
    sessions.set(item.id, {
      provider: 'github',
      subject: '1',
      expiresAt: '2099-01-01T00:00:00.000Z',
      revokedAt: null,
      createdAt: FIXED_NOW,
      ...item,
    })
  }

  const db = {
    prepare(sql: string) {
      const query = sql.replace(/\s+/g, ' ').trim()
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (query.includes('DELETE FROM preview_transactions')) {
                const cutoff = args[0] as string
                for (const [id, tx] of transactions) {
                  if (tx.expiresAt < cutoff) transactions.delete(id)
                }
                return { meta: { changes: 1 } }
              }
              if (query.includes('DELETE FROM preview_sessions')) {
                const cutoff = args[0] as string
                for (const [id, row] of sessions) {
                  if (row.expiresAt < cutoff) sessions.delete(id)
                }
                return { meta: { changes: 1 } }
              }
              if (query.includes('INSERT INTO preview_transactions')) {
                const [id, provider, state, verifier, nonce, expiresAt] =
                  args as [
                    string,
                    string,
                    string,
                    string,
                    string | null,
                    string,
                  ]
                transactions.set(id, {
                  id,
                  provider,
                  state,
                  verifier,
                  nonce,
                  expiresAt,
                  consumedAt: null,
                  createdAt: FIXED_NOW,
                })
                return { meta: { changes: 1 } }
              }
              if (
                query.includes('UPDATE preview_transactions SET consumed_at')
              ) {
                const [when, id] = args as [string, string]
                const tx = transactions.get(id)
                if (!tx || tx.consumedAt !== null)
                  return { meta: { changes: 0 } }
                tx.consumedAt = when
                return { meta: { changes: 1 } }
              }
              if (query.includes('INSERT INTO preview_identities')) {
                const [provider, subject, email, displayName, lastSeen] =
                  args as [string, string, string | null, string | null, string]
                const existing = identities.get(key(provider, subject))
                if (existing) {
                  if (email) existing.email = email
                  if (displayName) existing.displayName = displayName
                  existing.lastSeenAt = lastSeen
                } else {
                  identities.set(key(provider, subject), {
                    provider,
                    subject,
                    email,
                    displayName,
                    approvedAt: null,
                    approvedBy: null,
                    revokedAt: null,
                    lastSeenAt: lastSeen,
                    createdAt: FIXED_NOW,
                  })
                }
                return { meta: { changes: 1 } }
              }
              if (query.includes('INSERT INTO preview_sessions')) {
                const [id, provider, subject, expiresAt] = args as [
                  string,
                  string,
                  string,
                  string,
                ]
                sessions.set(id, {
                  id,
                  provider,
                  subject,
                  expiresAt,
                  revokedAt: null,
                  createdAt: FIXED_NOW,
                })
                return { meta: { changes: 1 } }
              }
              if (query.includes('UPDATE preview_sessions SET revoked_at')) {
                const [when, id] = args as [string, string]
                const row = sessions.get(id)
                if (row) row.revokedAt = when
                return { meta: { changes: 1 } }
              }
              return { meta: { changes: 0 } }
            },
            async first<T>() {
              if (query.includes('FROM preview_transactions WHERE id')) {
                const tx = transactions.get(args[0] as string)
                if (!tx) return null
                return {
                  provider: tx.provider,
                  state: tx.state,
                  verifier: tx.verifier,
                  nonce: tx.nonce,
                  expiresAt: tx.expiresAt,
                  consumedAt: tx.consumedAt,
                } as T
              }
              if (query.includes('SELECT approved_at')) {
                const [provider, subject] = args as [string, string]
                const row = identities.get(key(provider, subject))
                if (!row) return null
                return {
                  approvedAt: row.approvedAt,
                  revokedAt: row.revokedAt,
                } as T
              }
              if (query.includes('JOIN preview_identities')) {
                const [sid, when] = args as [string, string]
                const row = sessions.get(sid)
                if (!row || row.revokedAt !== null || row.expiresAt <= when)
                  return null
                const identity = identities.get(key(row.provider, row.subject))
                if (
                  !identity ||
                  identity.approvedAt === null ||
                  identity.revokedAt !== null
                )
                  return null
                return { id: row.id } as T
              }
              return null
            },
            async all<T>() {
              return { results: [] as T[] }
            },
          }
        },
      }
    },
  } as unknown as D1Database
  return Object.assign(db, { identities, sessions, transactions })
}

function baseConfig(
  overrides: Partial<PreviewAuthConfig> = {},
): PreviewAuthConfig {
  return {
    sessionSecret: 'preview-session-secret',
    google: {
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
    },
    github: {
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
    },
    ...overrides,
  }
}

function request(pathname: string, init: RequestInit = {}): Request {
  return new Request(`https://example.workers.dev${pathname}`, init)
}

type CookieHeaders = Headers & { getSetCookie?: () => string[] }

function cookieFromResponse(
  response: Response,
  name: string,
): string | undefined {
  const setCookies = (response.headers as CookieHeaders).getSetCookie?.() ?? []
  for (const setCookie of setCookies) {
    const entry = setCookie
      .split(';')
      .find((part) => part.trim().startsWith(`${name}=`))
    if (entry) return entry.trim().slice(name.length + 1)
  }
  return undefined
}

async function sessionCookie(
  sid: string,
  secret = 'preview-session-secret',
): Promise<string> {
  const token = await new SignJWT({ sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(new TextEncoder().encode(secret))
  return `${SESSION_COOKIE}=${token}`
}

let googleKeys: { privateKey: CryptoKey; publicKey: CryptoKey }
let jwks: { keys: Array<Record<string, unknown>> }

before(async () => {
  googleKeys = await generateKeyPair('RS256', { extractable: true })
  const publicJwk = await exportJWK(googleKeys.publicKey)
  jwks = {
    keys: [{ ...publicJwk, kid: 'preview-test', alg: 'RS256', use: 'sig' }],
  }
})

async function makeIdToken(
  claims: Record<string, unknown>,
  nonce: string,
): Promise<string> {
  return new SignJWT({ nonce, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'preview-test' })
    .setIssuer('https://accounts.google.com')
    .setAudience('google-client-id')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(googleKeys.privateKey)
}

function installFetchMock(
  routes: Array<{
    url: string
    response: (body: string | undefined) => Response
  }>,
): () => void {
  const original = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const route = routes.find((candidate) => url.startsWith(candidate.url))
    if (!route) throw new Error(`unexpected fetch: ${url}`)
    return route.response(init?.body == null ? undefined : String(init.body))
  }
  return () => {
    globalThis.fetch = original
  }
}

function installGoogleMock(
  idToken: string,
  bodies: Array<string | undefined> = [],
): () => void {
  return installFetchMock([
    {
      url: 'https://oauth2.googleapis.com/token',
      response: (body) => {
        bodies.push(body)
        return new Response(JSON.stringify({ id_token: idToken }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    },
    {
      url: 'https://www.googleapis.com/oauth2/v3/certs',
      response: () =>
        new Response(JSON.stringify(jwks), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    },
  ])
}

function installGithubMock(bodies: Array<string | undefined> = []): () => void {
  return installFetchMock([
    {
      url: 'https://github.com/login/oauth/access_token',
      response: (body) => {
        bodies.push(body)
        return new Response(
          JSON.stringify({ access_token: 'gho_test_token' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      },
    },
    {
      url: 'https://api.github.com/user',
      response: () =>
        new Response(
          JSON.stringify({ id: 12345678, login: 'octocat', name: 'Octo' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    },
  ])
}

test('login page shows only configured providers', async () => {
  const db = createPreviewDb()
  const config = baseConfig({ google: null })
  const response = await handlePreviewAuth(request('/'), config, db)
  assert.equal(response?.status, 200)
  const body = await response.text()
  assert.match(body, /GitHub でログイン/)
  assert.doesNotMatch(body, /Google でログイン/)
})

test('unconfigured provider login and callback return 503', async () => {
  const db = createPreviewDb()
  const config = baseConfig({ google: null })
  const login = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  assert.equal(login?.status, 503)
  const callback = await handlePreviewAuth(
    request('/auth/callback/google?code=x&state=y'),
    config,
    db,
  )
  assert.equal(callback?.status, 503)
})

test('Google login stores a transaction and uses PKCE and nonce', async () => {
  const db = createPreviewDb()
  const config = baseConfig()
  const response = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  assert.equal(response?.status, 302)
  assert.equal(db.transactions.size, 1)
  const tx = db.transactions.values().next().value as TransactionRow
  const location = new URL(response.headers.get('location') ?? '')
  assert.equal(location.origin, 'https://accounts.google.com')
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  assert.ok(location.searchParams.get('code_challenge'))
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(tx.verifier),
  )
  assert.equal(
    location.searchParams.get('code_challenge'),
    Buffer.from(digest).toString('base64url'),
  )
  assert.ok(location.searchParams.get('nonce'))
  assert.equal(location.searchParams.get('state'), tx.state)
  assert.match(
    response.headers.get('set-cookie') ?? '',
    /__Host-ten-preview-oauth-google=.*HttpOnly.*Secure.*SameSite=Lax/,
  )
})

test('GitHub login omits nonce and disables signup', async () => {
  const db = createPreviewDb()
  const config = baseConfig()
  const response = await handlePreviewAuth(
    request('/auth/login/github'),
    config,
    db,
  )
  assert.equal(response?.status, 302)
  const location = new URL(response.headers.get('location') ?? '')
  assert.equal(location.origin, 'https://github.com')
  assert.equal(location.searchParams.get('nonce'), null)
  assert.equal(location.searchParams.get('allow_signup'), 'false')
  assert.equal(location.searchParams.get('scope'), null)
})

test('Google callback signs in an approved identity', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'google',
        subject: 'google-sub-1',
        email: 'tester@example.com',
        approvedAt: FIXED_NOW,
      },
    ],
  })
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}google`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const idToken = await makeIdToken(
    {
      sub: 'google-sub-1',
      email: 'tester@example.com',
      email_verified: true,
      name: 'Tester',
    },
    tx.nonce as string,
  )
  const restore = installGoogleMock(idToken)
  try {
    const response = await handlePreviewAuth(
      request(
        `/auth/callback/google?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}google=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(response?.status, 303)
    assert.equal(response.headers.get('location'), '/')
    const session = cookieFromResponse(response, SESSION_COOKIE)
    assert.ok(session)
    assert.equal(db.sessions.size, 1)
    const identity = db.identities.get('google:google-sub-1')
    assert.equal(identity?.displayName, 'Tester')
  } finally {
    restore()
  }
})

test('Google callback records a pending identity and denies access', async () => {
  const db = createPreviewDb()
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}google`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const idToken = await makeIdToken(
    { sub: 'new-user', email: 'new@example.com', email_verified: true },
    tx.nonce as string,
  )
  const restore = installGoogleMock(idToken)
  try {
    const response = await handlePreviewAuth(
      request(
        `/auth/callback/google?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}google=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(response?.status, 403)
    const body = await response.text()
    assert.match(body, /google:new-user/)
    assert.equal(db.sessions.size, 0)
    const identity = db.identities.get('google:new-user')
    assert.ok(identity)
    assert.equal(identity.approvedAt, null)
    assert.equal(identity.email, 'new@example.com')
  } finally {
    restore()
  }
})

test('Google callback rejects a revoked identity', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'google',
        subject: 'revoked-user',
        approvedAt: FIXED_NOW,
        revokedAt: FIXED_NOW,
      },
    ],
  })
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}google`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const idToken = await makeIdToken(
    { sub: 'revoked-user', email_verified: true },
    tx.nonce as string,
  )
  const restore = installGoogleMock(idToken)
  try {
    const response = await handlePreviewAuth(
      request(
        `/auth/callback/google?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}google=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(response?.status, 403)
    assert.equal(db.sessions.size, 0)
  } finally {
    restore()
  }
})

test('Google callback rejects an unverified email', async () => {
  const db = createPreviewDb()
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}google`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const idToken = await makeIdToken(
    { sub: 'no-verified-email', email: 'x@example.com' },
    tx.nonce as string,
  )
  const restore = installGoogleMock(idToken)
  try {
    const response = await handlePreviewAuth(
      request(
        `/auth/callback/google?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}google=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(response?.status, 401)
  } finally {
    restore()
  }
})

test('Google callback rejects a mismatched nonce', async () => {
  const db = createPreviewDb()
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}google`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const idToken = await makeIdToken(
    { sub: 'nonce-mismatch', email_verified: true },
    'wrong-nonce',
  )
  const restore = installGoogleMock(idToken)
  try {
    const response = await handlePreviewAuth(
      request(
        `/auth/callback/google?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}google=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(response?.status, 401)
  } finally {
    restore()
  }
})

test('Google callback rejects a mismatched state and clears the cookie', async () => {
  const db = createPreviewDb()
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}google`,
  )
  const response = await handlePreviewAuth(
    request('/auth/callback/google?code=valid-code&state=wrong-state', {
      headers: { cookie: `${OAUTH_COOKIE}google=${oauthCookie}` },
    }),
    config,
    db,
  )
  assert.equal(response?.status, 401)
  assert.equal(cookieFromResponse(response, `${OAUTH_COOKIE}google`), '')
})

test('OAuth transaction is consumed once and cannot be replayed', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'github',
        subject: '12345678',
        displayName: 'octocat',
        approvedAt: FIXED_NOW,
      },
    ],
  })
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/github'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}github`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const restore = installGithubMock()
  try {
    const first = await handlePreviewAuth(
      request(
        `/auth/callback/github?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}github=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(first?.status, 303)
    assert.ok(db.transactions.values().next().value?.consumedAt)
    const replay = await handlePreviewAuth(
      request(
        `/auth/callback/github?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}github=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(replay?.status, 401)
  } finally {
    restore()
  }
})

test('GitHub callback signs in an approved identity', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'github',
        subject: '12345678',
        approvedAt: FIXED_NOW,
      },
    ],
  })
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/github'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}github`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const restore = installGithubMock()
  try {
    const response = await handlePreviewAuth(
      request(
        `/auth/callback/github?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}github=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(response?.status, 303)
    const session = cookieFromResponse(response, SESSION_COOKIE)
    assert.ok(session)
    const identity = db.identities.get('github:12345678')
    assert.equal(identity?.displayName, 'Octo')
  } finally {
    restore()
  }
})

test('GitHub token exchange sends the transaction PKCE verifier', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'github',
        subject: '12345678',
        approvedAt: FIXED_NOW,
      },
    ],
  })
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/github'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}github`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const bodies: Array<string | undefined> = []
  const restore = installGithubMock(bodies)
  try {
    const response = await handlePreviewAuth(
      request(
        `/auth/callback/github?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}github=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(response?.status, 303)
    const params = new URLSearchParams(bodies[0] ?? '')
    assert.equal(params.get('code'), 'valid-code')
    assert.equal(params.get('code_verifier'), tx.verifier)
    assert.equal(
      params.get('redirect_uri'),
      'https://example.workers.dev/auth/callback/github',
    )
  } finally {
    restore()
  }
})

test('Google token exchange sends the transaction PKCE verifier', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'google',
        subject: 'google-sub-1',
        approvedAt: FIXED_NOW,
      },
    ],
  })
  const config = baseConfig()
  const begin = await handlePreviewAuth(
    request('/auth/login/google'),
    config,
    db,
  )
  const oauthCookie = cookieFromResponse(
    begin as Response,
    `${OAUTH_COOKIE}google`,
  )
  const tx = db.transactions.values().next().value as TransactionRow
  const idToken = await makeIdToken(
    { sub: 'google-sub-1', email: 'tester@example.com', email_verified: true },
    tx.nonce as string,
  )
  const bodies: Array<string | undefined> = []
  const restore = installGoogleMock(idToken, bodies)
  try {
    const response = await handlePreviewAuth(
      request(
        `/auth/callback/google?code=valid-code&state=${encodeURIComponent(tx.state)}`,
        { headers: { cookie: `${OAUTH_COOKIE}google=${oauthCookie}` } },
      ),
      config,
      db,
    )
    assert.equal(response?.status, 303)
    const params = new URLSearchParams(bodies[0] ?? '')
    assert.equal(params.get('code'), 'valid-code')
    assert.equal(params.get('code_verifier'), tx.verifier)
    assert.equal(
      params.get('redirect_uri'),
      'https://example.workers.dev/auth/callback/google',
    )
  } finally {
    restore()
  }
})

test('a valid session allows access and expired sessions are rejected', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'github',
        subject: '12345678',
        approvedAt: FIXED_NOW,
      },
    ],
    sessions: [
      { id: 'session-active', provider: 'github', subject: '12345678' },
      {
        id: 'session-expired',
        provider: 'github',
        subject: '12345678',
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
      {
        id: 'session-revoked',
        provider: 'github',
        subject: '12345678',
        revokedAt: FIXED_NOW,
      },
    ],
  })
  const config = baseConfig()

  const allowed = await handlePreviewAuth(
    request('/', {
      headers: { cookie: await sessionCookie('session-active') },
    }),
    config,
    db,
  )
  assert.equal(allowed, null)

  for (const sid of ['session-expired', 'session-revoked']) {
    const denied = await handlePreviewAuth(
      request('/', { headers: { cookie: await sessionCookie(sid) } }),
      config,
      db,
    )
    assert.equal(denied?.status, 200)
  }

  const tampered = await handlePreviewAuth(
    request('/', {
      headers: { cookie: `${SESSION_COOKIE}=garbage.token.value` },
    }),
    config,
    db,
  )
  assert.equal(tampered?.status, 200)
})

test('a revoked identity invalidates active sessions', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'github',
        subject: '12345678',
        approvedAt: FIXED_NOW,
        revokedAt: FIXED_NOW,
      },
    ],
    sessions: [
      { id: 'session-active', provider: 'github', subject: '12345678' },
    ],
  })
  const config = baseConfig()
  const denied = await handlePreviewAuth(
    request('/', {
      headers: { cookie: await sessionCookie('session-active') },
    }),
    config,
    db,
  )
  assert.equal(denied?.status, 200)
})

test('logout revokes the session and requires same-origin POST', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'github',
        subject: '12345678',
        approvedAt: FIXED_NOW,
      },
    ],
    sessions: [
      { id: 'session-active', provider: 'github', subject: '12345678' },
    ],
  })
  const config = baseConfig()

  const crossOrigin = await handlePreviewAuth(
    request('/auth/logout', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example.com',
        cookie: await sessionCookie('session-active'),
      },
    }),
    config,
    db,
  )
  assert.equal(crossOrigin?.status, 400)
  assert.equal(db.sessions.get('session-active')?.revokedAt, null)

  const loggedOut = await handlePreviewAuth(
    request('/auth/logout', {
      method: 'POST',
      headers: {
        origin: 'https://example.workers.dev',
        cookie: await sessionCookie('session-active'),
      },
    }),
    config,
    db,
  )
  assert.equal(loggedOut?.status, 303)
  assert.ok(db.sessions.get('session-active')?.revokedAt)

  const denied = await handlePreviewAuth(
    request('/', {
      headers: { cookie: await sessionCookie('session-active') },
    }),
    config,
    db,
  )
  assert.equal(denied?.status, 200)
})

test('GET logout shows a confirm page with a POST form', async () => {
  const db = createPreviewDb()
  const config = baseConfig()
  const response = await handlePreviewAuth(request('/auth/logout'), config, db)
  assert.equal(response?.status, 200)
  const body = await response.text()
  assert.match(body, /method="post"/)
})

test('logout rejects a null or malformed origin without revoking', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'github',
        subject: '12345678',
        approvedAt: FIXED_NOW,
      },
    ],
    sessions: [
      { id: 'session-active', provider: 'github', subject: '12345678' },
    ],
  })
  const config = baseConfig()
  for (const origin of [
    'null',
    'not-a-url',
    'https://example.workers.dev.evil.example',
  ]) {
    const response = await handlePreviewAuth(
      request('/auth/logout', {
        method: 'POST',
        headers: {
          origin,
          cookie: await sessionCookie('session-active'),
        },
      }),
      config,
      db,
    )
    assert.equal(response?.status, 400)
    assert.equal(db.sessions.get('session-active')?.revokedAt, null)
  }
})

test('health endpoint is public and requires no session', async () => {
  const db = createPreviewDb()
  const config = baseConfig()
  const response = await handlePreviewAuth(request('/api/health'), config, db)
  assert.equal(response, null)
})

test('missing session secret fails closed except for health', async () => {
  const db = createPreviewDb()
  const config = baseConfig({ sessionSecret: null })
  const health = await handlePreviewAuth(request('/api/health'), config, db)
  assert.equal(health, null)
  const protectedPath = await handlePreviewAuth(request('/'), config, db)
  assert.equal(protectedPath?.status, 503)
})

test('preview mode requires authentication before assets', async () => {
  const db = createPreviewDb({
    identities: [
      {
        provider: 'github',
        subject: '12345678',
        approvedAt: FIXED_NOW,
      },
    ],
    sessions: [
      { id: 'session-active', provider: 'github', subject: '12345678' },
    ],
  })
  const env: Env = {
    DB: db,
    DAILY_CACHE: {} as KVNamespace,
    AUTH_SECRET: 'auth-secret',
    ADMIN_SECRET: 'admin-secret',
    PREVIEW_MODE: 'required',
    PREVIEW_SESSION_SECRET: 'preview-session-secret',
    GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
    GITHUB_OAUTH_CLIENT_ID: 'github-client-id',
    GITHUB_OAUTH_CLIENT_SECRET: 'github-client-secret',
    ASSETS: { fetch: async () => new Response('asset') } as unknown as Fetcher,
  }

  const unauthenticated = await worker.fetch(request('/'), env)
  assert.equal(unauthenticated.status, 200)
  assert.match(await unauthenticated.text(), /Google でログイン/)

  const authenticated = await worker.fetch(
    request('/', {
      headers: { cookie: await sessionCookie('session-active') },
    }),
    env,
  )
  assert.equal(authenticated.status, 200)
  assert.equal(await authenticated.text(), 'asset')
  assert.equal(authenticated.headers.get('cache-control'), 'private, no-store')
})

test('unset preview mode with preview bindings fails closed', async () => {
  const env: Env = {
    DB: {} as unknown as D1Database,
    DAILY_CACHE: {} as KVNamespace,
    AUTH_SECRET: 'auth-secret',
    ADMIN_SECRET: 'admin-secret',
    PREVIEW_SESSION_SECRET: 'preview-session-secret',
  }
  const response = await worker.fetch(request('/api/health'), env)
  assert.equal(response.status, 503)
})

test('disabled preview mode serves the app normally', async () => {
  const env: Env = {
    DB: {} as unknown as D1Database,
    DAILY_CACHE: {} as KVNamespace,
    AUTH_SECRET: 'auth-secret',
    ADMIN_SECRET: 'admin-secret',
    PREVIEW_MODE: 'disabled',
  }
  const response = await worker.fetch(request('/api/health'), env)
  assert.equal(response.status, 200)
})
