import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
)
const SESSION_TTL_SECONDS = 8 * 60 * 60
const OAUTH_TTL_SECONDS = 10 * 60
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000
const OAUTH_TTL_MS = OAUTH_TTL_SECONDS * 1000

export type OAuthProvider = 'google' | 'github'

export type OAuthIdentity = {
  provider: OAuthProvider
  subject: string
  email: string | null
  displayName: string | null
}

export type OAuthProviderConfig = { clientId: string; clientSecret: string }

export type OAuthAppConfig = {
  sessionSecret: string | null
  google: OAuthProviderConfig | null
  github: OAuthProviderConfig | null
  sessionCookieName: string
  oauthCookiePrefix: string
  loginTitle: string
  loginHeading: string
  loginDescription: string
  unapprovedHeading: string
  unapprovedDescription: string
}

export type OAuthHooks = {
  recordIdentity: (db: D1Database, identity: OAuthIdentity) => Promise<void>
  isAllowed: (db: D1Database, identity: OAuthIdentity) => Promise<boolean>
}

export class OAuthConfigError extends Error {}

type TransactionRow = {
  provider: OAuthProvider
  state: string
  verifier: string
  nonce: string | null
  expiresAt: string
  consumedAt: string | null
}

const AUTH_PAGE_STYLE = `
  :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; background: #09090b; color: #f4f4f5; }
  main { display: flex; min-height: 100vh; min-height: 100svh; max-width: 28rem; margin: 0 auto; padding: 1.5rem; flex-direction: column; justify-content: center; gap: 1rem; text-align: center; }
  h1 { margin: 0; font-size: 1.25rem; line-height: 1.75rem; font-weight: 600; }
  p { margin: 0; color: #a1a1aa; font-size: 0.875rem; line-height: 1.25rem; }
  form { margin: 0; }
  a, button { display: inline-block; width: 100%; border: 0; border-radius: 0.375rem; padding: 0.625rem 1rem; background: #f4f4f5; color: #18181b; font: inherit; font-size: 0.875rem; font-weight: 500; line-height: 1.25rem; text-decoration: none; cursor: pointer; }
  a:hover, button:hover { background: #fff; }
  a:focus-visible, button:focus-visible { outline: 2px solid #a1a1aa; outline-offset: 2px; }
  code { display: block; overflow-wrap: anywhere; border-radius: 0.375rem; background: #18181b; padding: 0.5rem 0.75rem; color: #d4d4d8; font-size: 0.75rem; line-height: 1rem; }
`

export function htmlResponse(
  title: string,
  body: string,
  status = 200,
): Response {
  return new Response(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${AUTH_PAGE_STYLE}</style></head><body><main>${body}</main></body></html>`,
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'content-security-policy':
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
        'content-type': 'text/html; charset=utf-8',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
    },
  )
}

export function configErrorResponse(
  message: string,
  title = 'サービスを利用できません',
): Response {
  return htmlResponse(
    title,
    `<h1>${title}</h1><p>${escapeHtml(message)}</p>`,
    503,
  )
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
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
  const parts = [
    `${name}=${value}`,
    `Max-Age=${Math.max(0, maxAge)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ]
  return parts.join('; ')
}

function clearCookieHeader(name: string): string {
  return cookieHeader(name, '', 0)
}

function nowIso(): string {
  return new Date().toISOString()
}

async function cleanupExpired(db: D1Database): Promise<void> {
  const now = nowIso()
  await db
    .prepare('DELETE FROM oauth_transactions WHERE expires_at < ?')
    .bind(now)
    .run()
  await db
    .prepare('DELETE FROM oauth_sessions WHERE expires_at < ?')
    .bind(now)
    .run()
}

function providerFromPath(pathname: string): OAuthProvider | null {
  if (pathname.endsWith('/google')) return 'google'
  if (pathname.endsWith('/github')) return 'github'
  return null
}

function providerConfig(
  config: OAuthAppConfig,
  provider: OAuthProvider,
): OAuthProviderConfig | null {
  return provider === 'google' ? config.google : config.github
}

function providerLinksHtml(config: OAuthAppConfig): string {
  const links: string[] = []
  if (config.google)
    links.push('<p><a href="/auth/login/google">Google でログイン</a></p>')
  if (config.github)
    links.push('<p><a href="/auth/login/github">GitHub でログイン</a></p>')
  return links.join('')
}

function loginPage(config: OAuthAppConfig): Response {
  const links = providerLinksHtml(config)
  if (!links) {
    return configErrorResponse(
      '利用できるログイン方法が設定されていません',
      config.loginTitle,
    )
  }
  return htmlResponse(
    config.loginTitle,
    `<h1>${escapeHtml(config.loginHeading)}</h1><p>${escapeHtml(config.loginDescription)}</p>${links}`,
  )
}

export function loginPageResponse(config: OAuthAppConfig): Response {
  return loginPage(config)
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  return bytesToBase64Url(new Uint8Array(digest))
}

function callbackUrl(request: Request, provider: OAuthProvider): string {
  const url = new URL(request.url)
  return `${url.origin}/auth/callback/${provider}`
}

function requireProvider(
  config: OAuthAppConfig,
  provider: OAuthProvider,
): OAuthProviderConfig & { sessionSecret: string } {
  const sessionSecret = config.sessionSecret
  const providerConf = providerConfig(config, provider)
  if (!sessionSecret) {
    throw new OAuthConfigError('セッション署名用のシークレットが未設定です')
  }
  if (!providerConf) {
    throw new OAuthConfigError(`${provider} OAuth が設定されていません`)
  }
  return { ...providerConf, sessionSecret }
}

async function beginLogin(
  request: Request,
  config: OAuthAppConfig,
  db: D1Database,
  provider: OAuthProvider,
): Promise<Response> {
  const { clientId, sessionSecret } = requireProvider(config, provider)
  const state = randomValue()
  const verifier = randomValue()
  const nonce = provider === 'google' ? randomValue() : undefined
  const tid = randomValue()
  const expiresAt = new Date(Date.now() + OAUTH_TTL_MS).toISOString()
  await cleanupExpired(db)
  await db
    .prepare(
      `INSERT INTO oauth_transactions
         (id, provider, state, verifier, nonce, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(tid, provider, state, verifier, nonce ?? null, expiresAt)
    .run()
  const token = await signPayload({ tid }, sessionSecret, OAUTH_TTL_SECONDS)
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
    url.searchParams.set('allow_signup', 'false')
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      'set-cookie': cookieHeader(
        `${config.oauthCookiePrefix}${provider}`,
        token,
        OAUTH_TTL_SECONDS,
      ),
      'cache-control': 'no-store',
    },
  })
}

async function googleIdentity(
  request: Request,
  config: OAuthAppConfig,
  code: string,
  transaction: { verifier: string; nonce: string | null },
): Promise<OAuthIdentity | null> {
  const { clientId, clientSecret } = requireProvider(config, 'google')
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: transaction.verifier,
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
  if (
    payload.nonce !== transaction.nonce ||
    typeof payload.sub !== 'string' ||
    payload.email_verified !== true
  ) {
    return null
  }
  return {
    provider: 'google',
    subject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    displayName: typeof payload.name === 'string' ? payload.name : null,
  }
}

async function githubIdentity(
  request: Request,
  config: OAuthAppConfig,
  code: string,
  transaction: { verifier: string },
): Promise<OAuthIdentity | null> {
  const { clientId, clientSecret } = requireProvider(config, 'github')
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
      code_verifier: transaction.verifier,
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
      'user-agent': 'ten-oauth',
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

async function completeLogin(
  request: Request,
  config: OAuthAppConfig,
  db: D1Database,
  hooks: OAuthHooks,
  provider: OAuthProvider,
): Promise<Response> {
  const { sessionSecret } = requireProvider(config, provider)
  const url = new URL(request.url)
  const cookieName = `${config.oauthCookiePrefix}${provider}`
  const payload = await verifyPayload(
    cookieValue(request, cookieName),
    sessionSecret,
  )
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const fail = (message: string): Response => {
    const response = htmlResponse(
      'ログインに失敗しました',
      `<p>${escapeHtml(message)}</p><p><a href="/auth/login">ログイン画面へ戻る</a></p>`,
      401,
    )
    response.headers.set('set-cookie', clearCookieHeader(cookieName))
    return response
  }

  if (!payload || typeof payload.tid !== 'string' || !code || !state) {
    return fail('もう一度ログインしてください。')
  }
  const transaction = await db
    .prepare(
      `SELECT provider, state, verifier, nonce,
          expires_at AS expiresAt, consumed_at AS consumedAt
        FROM oauth_transactions WHERE id = ?`,
    )
    .bind(payload.tid)
    .first<TransactionRow>()
  if (
    !transaction ||
    transaction.provider !== provider ||
    transaction.state !== state ||
    transaction.consumedAt !== null ||
    new Date(transaction.expiresAt).getTime() <= Date.now()
  ) {
    return fail('もう一度ログインしてください。')
  }
  const consumed = await db
    .prepare(
      `UPDATE oauth_transactions
       SET consumed_at = ?
       WHERE id = ? AND consumed_at IS NULL`,
    )
    .bind(nowIso(), payload.tid)
    .run()
  if (consumed.meta.changes !== 1) {
    return fail('もう一度ログインしてください。')
  }

  let identity: OAuthIdentity | null = null
  try {
    identity =
      provider === 'google'
        ? await googleIdentity(request, config, code, {
            verifier: transaction.verifier,
            nonce: transaction.nonce,
          })
        : await githubIdentity(request, config, code, {
            verifier: transaction.verifier,
          })
  } catch {
    return fail('認証情報を確認できませんでした。')
  }
  if (!identity) return fail('認証情報を確認できませんでした。')

  await hooks.recordIdentity(db, identity)

  if (!(await hooks.isAllowed(db, identity))) {
    const label = identity.email ?? identity.displayName ?? identity.subject
    const response = htmlResponse(
      '承認待ちです',
      `<h1>${escapeHtml(config.unapprovedHeading)}</h1>
       <p>${escapeHtml(config.unapprovedDescription)}</p>
       <code>${escapeHtml(identity.provider)}:${escapeHtml(identity.subject)}</code>
       <p>(${escapeHtml(label)})</p>
       <p>承認されたら、下のボタンから再度ログインできます。</p>
       ${providerLinksHtml(config)}`,
      403,
    )
    response.headers.set('set-cookie', clearCookieHeader(cookieName))
    return response
  }

  const sessionId = randomValue()
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  await db
    .prepare(
      `INSERT INTO oauth_sessions (id, provider, subject, expires_at) VALUES (?, ?, ?, ?)`,
    )
    .bind(sessionId, identity.provider, identity.subject, sessionExpiresAt)
    .run()
  const session = await signPayload(
    { sid: sessionId },
    sessionSecret,
    SESSION_TTL_SECONDS,
  )
  const headers = new Headers({
    location: '/',
    'cache-control': 'no-store',
  })
  headers.append('set-cookie', clearCookieHeader(cookieName))
  headers.append(
    'set-cookie',
    cookieHeader(config.sessionCookieName, session, SESSION_TTL_SECONDS),
  )
  return new Response(null, { status: 303, headers })
}

export async function requireSession(
  request: Request,
  config: OAuthAppConfig,
  db: D1Database,
  hooks: OAuthHooks,
): Promise<OAuthIdentity | null> {
  const secret = config.sessionSecret
  if (!secret) return null
  const payload = await verifyPayload(
    cookieValue(request, config.sessionCookieName),
    secret,
  )
  if (!payload || typeof payload.sid !== 'string') return null
  const now = nowIso()
  try {
    const row = await db
      .prepare(
        `SELECT s.provider AS provider, s.subject AS subject
         FROM oauth_sessions s
         WHERE s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ?`,
      )
      .bind(payload.sid, now)
      .first<{ provider: OAuthProvider; subject: string }>()
    if (!row) return null
    const identity: OAuthIdentity = {
      provider: row.provider,
      subject: row.subject,
      email: null,
      displayName: null,
    }
    if (!(await hooks.isAllowed(db, identity))) return null
    return identity
  } catch {
    return null
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

async function performLogout(
  request: Request,
  config: OAuthAppConfig,
  db: D1Database,
): Promise<Response> {
  if (!sameOrigin(request)) {
    return htmlResponse(
      'ログアウトできません',
      '<p>同じ画面からログアウトしてください。</p>',
      400,
    )
  }
  const secret = config.sessionSecret
  const payload = secret
    ? await verifyPayload(
        cookieValue(request, config.sessionCookieName),
        secret,
      )
    : null
  if (payload && typeof payload.sid === 'string') {
    try {
      await db
        .prepare('UPDATE oauth_sessions SET revoked_at = ? WHERE id = ?')
        .bind(nowIso(), payload.sid)
        .run()
    } catch {
      // 失効失敗時も Cookie は削除する
    }
  }
  const headers = new Headers({
    location: '/auth/login',
    'cache-control': 'no-store',
  })
  headers.append('set-cookie', clearCookieHeader(config.sessionCookieName))
  return new Response(null, { status: 303, headers })
}

export async function handleAuthRoutes(
  request: Request,
  config: OAuthAppConfig,
  db: D1Database,
  hooks: OAuthHooks,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname

  try {
    if (pathname === '/auth/login') return loginPage(config)
    if (
      pathname === '/auth/login/google' ||
      pathname === '/auth/login/github'
    ) {
      const provider = providerFromPath(pathname)
      if (!provider) return loginPage(config)
      return await beginLogin(request, config, db, provider)
    }
    if (
      pathname === '/auth/callback/google' ||
      pathname === '/auth/callback/github'
    ) {
      const provider = providerFromPath(pathname)
      if (!provider) return loginPage(config)
      return await completeLogin(request, config, db, hooks, provider)
    }
    if (pathname === '/auth/logout') {
      if (request.method === 'POST')
        return await performLogout(request, config, db)
      return htmlResponse(
        'ログアウト',
        '<h1>ログアウト</h1><form method="post" action="/auth/logout"><button type="submit">ログアウトする</button></form>',
      )
    }
  } catch (error) {
    if (error instanceof OAuthConfigError) {
      return configErrorResponse(error.message, config.loginTitle)
    }
    throw error
  }

  return null
}

export async function upsertPreviewIdentity(
  db: D1Database,
  identity: OAuthIdentity,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO preview_identities
         (provider, subject, email, display_name, last_seen_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(provider, subject) DO UPDATE SET
         email = COALESCE(excluded.email, preview_identities.email),
         display_name = COALESCE(
           excluded.display_name, preview_identities.display_name),
         last_seen_at = excluded.last_seen_at`,
    )
    .bind(
      identity.provider,
      identity.subject,
      identity.email,
      identity.displayName,
      nowIso(),
    )
    .run()
}

export async function isPreviewIdentityAllowed(
  db: D1Database,
  identity: OAuthIdentity,
): Promise<boolean> {
  const approval = await db
    .prepare(
      `SELECT approved_at AS approvedAt, revoked_at AS revokedAt
       FROM preview_identities WHERE provider = ? AND subject = ?`,
    )
    .bind(identity.provider, identity.subject)
    .first<{ approvedAt: string | null; revokedAt: string | null }>()
  return Boolean(
    approval && approval.approvedAt !== null && approval.revokedAt === null,
  )
}

export async function upsertAdminIdentity(
  db: D1Database,
  identity: OAuthIdentity,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_identities
         (provider, subject, email, display_name)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(provider, subject) DO UPDATE SET
         email = COALESCE(excluded.email, admin_identities.email),
         display_name = COALESCE(
           excluded.display_name, admin_identities.display_name)`,
    )
    .bind(
      identity.provider,
      identity.subject,
      identity.email,
      identity.displayName,
    )
    .run()
}

export async function isAdminIdentityAllowed(
  db: D1Database,
  identity: OAuthIdentity,
): Promise<boolean> {
  const approval = await db
    .prepare(
      `SELECT approved_at AS approvedAt, revoked_at AS revokedAt
       FROM admin_identities WHERE provider = ? AND subject = ?`,
    )
    .bind(identity.provider, identity.subject)
    .first<{ approvedAt: string | null; revokedAt: string | null }>()
  return Boolean(
    approval && approval.approvedAt !== null && approval.revokedAt === null,
  )
}
