import { generateCookie } from 'hono/cookie'
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'

const SESSION_COOKIE = '__Host-ten-preview-session'
const OAUTH_COOKIE_PREFIX = '__Host-ten-preview-oauth-'
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
)
const SESSION_TTL_SECONDS = 8 * 60 * 60
const OAUTH_TTL_SECONDS = 10 * 60

export type PreviewEnv = {
  DB: D1Database
  ASSETS?: Fetcher
  PREVIEW_ENABLED?: string
  PREVIEW_SESSION_SECRET?: string
  PREVIEW_HEALTHCHECK_SECRET?: string
  GOOGLE_OAUTH_CLIENT_ID?: string
  GOOGLE_OAUTH_CLIENT_SECRET?: string
  GITHUB_OAUTH_CLIENT_ID?: string
  GITHUB_OAUTH_CLIENT_SECRET?: string
}

type Provider = 'google' | 'github'

type OAuthState = {
  provider: Provider
  state: string
  verifier: string
  nonce?: string
}

type Identity = {
  provider: Provider
  subject: string
  email: string | null
  displayName: string | null
}

function randomValue(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

async function signPayload(
  payload: JWTPayload,
  secret: string,
  expiresIn: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secretKey(secret))
}

async function verifyPayload(
  token: string | undefined,
  secret: string,
): Promise<JWTPayload | null> {
  if (!token) return null
  try {
    return (
      await jwtVerify(token, secretKey(secret), { algorithms: ['HS256'] })
    ).payload
  } catch {
    return null
  }
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get('cookie')
  if (!cookie) return undefined
  const entry = cookie
    .split(';')
    .find((part) => part.trim().startsWith(`${name}=`))
  return entry ? entry.trim().slice(name.length + 1) : undefined
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  return generateCookie(name, value, {
    prefix: 'host',
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'Lax',
    secure: true,
  })
}

function htmlResponse(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><body><main>${body}</main></body></html>`,
    {
      status,
      headers: {
        'content-security-policy':
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'content-type': 'text/html; charset=utf-8',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
    },
  )
}

function loginResponse(): Response {
  return htmlResponse(
    'TEN. preview',
    '<h1>TEN. 開発版プレビュー</h1><p>許可されたアカウントでログインしてください。</p><p><a href="/auth/login/google">Google でログイン</a></p><p><a href="/auth/login/github">GitHub でログイン</a></p>',
  )
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  return bytesToBase64Url(new Uint8Array(digest))
}

function callbackUrl(request: Request, provider: Provider): string {
  const url = new URL(request.url)
  return `${url.origin}/auth/callback/${provider}`
}

function config(env: PreviewEnv, provider: Provider) {
  const clientId =
    provider === 'google'
      ? env.GOOGLE_OAUTH_CLIENT_ID
      : env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret =
    provider === 'google'
      ? env.GOOGLE_OAUTH_CLIENT_SECRET
      : env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret || !env.PREVIEW_SESSION_SECRET) {
    throw new Error(`Missing ${provider} preview authentication configuration`)
  }
  return { clientId, clientSecret, sessionSecret: env.PREVIEW_SESSION_SECRET }
}

async function beginLogin(
  request: Request,
  env: PreviewEnv,
  provider: Provider,
): Promise<Response> {
  const { clientId, sessionSecret } = config(env, provider)
  const state = randomValue()
  const verifier = randomValue()
  const nonce = provider === 'google' ? randomValue() : undefined
  const payload: OAuthState = { provider, state, verifier, nonce }
  const token = await signPayload(payload, sessionSecret, OAUTH_TTL_SECONDS)
  const url = new URL(
    provider === 'google'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : 'https://github.com/login/oauth/authorize',
  )
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', callbackUrl(request, provider))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', await pkceChallenge(verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  if (provider === 'google') {
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('nonce', nonce ?? '')
    url.searchParams.set('prompt', 'select_account')
  } else {
    url.searchParams.set('scope', 'read:user')
    url.searchParams.set('allow_signup', 'false')
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      'set-cookie': cookieHeader(
        `${OAUTH_COOKIE_PREFIX}${provider}`,
        token,
        OAUTH_TTL_SECONDS,
      ),
    },
  })
}

async function googleIdentity(
  request: Request,
  env: PreviewEnv,
  code: string,
  state: OAuthState,
): Promise<Identity | null> {
  const { clientId, clientSecret } = config(env, 'google')
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: state.verifier,
    grant_type: 'authorization_code',
    redirect_uri: callbackUrl(request, 'google'),
  })
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) return null
  const result: { id_token?: string } = await response.json()
  if (!result.id_token) return null
  const { payload } = await jwtVerify(result.id_token, GOOGLE_JWKS, {
    algorithms: ['RS256'],
    audience: clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  })
  if (payload.nonce !== state.nonce || typeof payload.sub !== 'string')
    return null
  return {
    provider: 'google',
    subject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    displayName: typeof payload.name === 'string' ? payload.name : null,
  }
}

async function githubIdentity(
  request: Request,
  env: PreviewEnv,
  code: string,
  state: OAuthState,
): Promise<Identity | null> {
  const { clientId, clientSecret } = config(env, 'github')
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: state.verifier,
      redirect_uri: callbackUrl(request, 'github'),
    }),
  })
  if (!response.ok) return null
  const token: { access_token?: string } = await response.json()
  if (!token.access_token) return null
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token.access_token}`,
      'user-agent': 'ten-preview-auth',
      'x-github-api-version': '2022-11-28',
    },
  })
  if (!userResponse.ok) return null
  const user: {
    id?: number
    login?: string
    name?: string | null
  } = await userResponse.json()
  if (!Number.isSafeInteger(user.id)) return null
  return {
    provider: 'github',
    subject: String(user.id),
    email: null,
    displayName: user.name ?? user.login ?? null,
  }
}

async function isAllowed(
  env: PreviewEnv,
  identity: Identity,
): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT revoked_at AS revokedAt FROM preview_identities WHERE provider = ? AND subject = ?',
  )
    .bind(identity.provider, identity.subject)
    .first<{ revokedAt: string | null }>()
  return row !== null && row.revokedAt === null
}

async function completeLogin(
  request: Request,
  env: PreviewEnv,
  provider: Provider,
): Promise<Response> {
  const { sessionSecret } = config(env, provider)
  const url = new URL(request.url)
  const state = await verifyPayload(
    cookieValue(request, `${OAUTH_COOKIE_PREFIX}${provider}`),
    sessionSecret,
  )
  const code = url.searchParams.get('code')
  if (
    !code ||
    state?.provider !== provider ||
    typeof state.state !== 'string' ||
    typeof state.verifier !== 'string' ||
    state.state !== url.searchParams.get('state')
  ) {
    return htmlResponse(
      'ログインに失敗しました',
      '<p>もう一度ログインしてください。</p>',
      401,
    )
  }
  const oauthState: OAuthState = {
    provider,
    state: state.state,
    verifier: state.verifier,
    nonce: typeof state.nonce === 'string' ? state.nonce : undefined,
  }
  let identity: Identity | null = null
  try {
    identity =
      provider === 'google'
        ? await googleIdentity(request, env, code, oauthState)
        : await githubIdentity(request, env, code, oauthState)
  } catch {
    return htmlResponse(
      'ログインに失敗しました',
      '<p>認証情報を確認できませんでした。</p>',
      401,
    )
  }
  if (!identity) {
    return htmlResponse(
      'ログインに失敗しました',
      '<p>認証情報を確認できませんでした。</p>',
      401,
    )
  }
  if (!(await isAllowed(env, identity))) {
    return htmlResponse(
      '承認待ちです',
      `<h1>アクセスは未承認です</h1><p>管理者へ次の識別子を連絡してください。</p><code>${identity.provider}:${identity.subject}</code>`,
      403,
    )
  }
  const session = await signPayload(
    { provider: identity.provider, subject: identity.subject },
    sessionSecret,
    SESSION_TTL_SECONDS,
  )
  return new Response(null, {
    status: 303,
    headers: {
      location: '/',
      'set-cookie': cookieHeader(SESSION_COOKIE, session, SESSION_TTL_SECONDS),
    },
  })
}

async function hasSession(request: Request, env: PreviewEnv): Promise<boolean> {
  const secret = env.PREVIEW_SESSION_SECRET
  if (!secret) return false
  const payload = await verifyPayload(
    cookieValue(request, SESSION_COOKIE),
    secret,
  )
  if (
    (payload?.provider !== 'google' && payload?.provider !== 'github') ||
    typeof payload.subject !== 'string'
  ) {
    return false
  }
  return isAllowed(env, {
    provider: payload.provider,
    subject: payload.subject,
    email: null,
    displayName: null,
  })
}

export async function handlePreviewAuth(
  request: Request,
  env: PreviewEnv,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname === '/auth/login') return loginResponse()
  if (url.pathname === '/auth/login/google')
    return beginLogin(request, env, 'google')
  if (url.pathname === '/auth/login/github')
    return beginLogin(request, env, 'github')
  if (url.pathname === '/auth/callback/google')
    return completeLogin(request, env, 'google')
  if (url.pathname === '/auth/callback/github')
    return completeLogin(request, env, 'github')
  if (url.pathname === '/auth/logout') {
    return new Response(null, {
      status: 303,
      headers: {
        location: '/auth/login',
        'set-cookie': cookieHeader(SESSION_COOKIE, '', 0),
      },
    })
  }
  if (
    url.pathname === '/api/health' &&
    env.PREVIEW_HEALTHCHECK_SECRET &&
    request.headers.get('authorization') ===
      `Bearer ${env.PREVIEW_HEALTHCHECK_SECRET}`
  ) {
    return null
  }
  return (await hasSession(request, env)) ? null : loginResponse()
}
