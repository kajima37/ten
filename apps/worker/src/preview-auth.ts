import {
  configErrorResponse,
  handleAuthRoutes,
  isPreviewIdentityAllowed,
  loginPageResponse,
  requireSession,
  upsertPreviewIdentity,
} from '@ten/oauth'
import type { OAuthAppConfig, OAuthHooks } from '@ten/oauth'

import type { PreviewAuthConfig } from './env.ts'

export type { PreviewAuthConfig }

const SESSION_COOKIE = '__Host-ten-preview-session'
const OAUTH_COOKIE_PREFIX = '__Host-ten-preview-oauth-'

const hooks: OAuthHooks = {
  recordIdentity: (db, identity) => upsertPreviewIdentity(db, identity),
  isAllowed: (db, identity) => isPreviewIdentityAllowed(db, identity),
}

function authConfig(config: PreviewAuthConfig): OAuthAppConfig {
  return {
    sessionSecret: config.sessionSecret,
    google: config.google,
    github: config.github,
    sessionCookieName: SESSION_COOKIE,
    oauthCookiePrefix: OAUTH_COOKIE_PREFIX,
    loginTitle: 'TEN. preview',
    loginHeading: 'TEN. 開発版プレビュー',
    loginDescription: '許可されたアカウントでログインしてください。',
    unapprovedHeading: 'アクセスは未承認です',
    unapprovedDescription: '管理者へ次の識別子を連絡してください。',
  }
}

export async function handlePreviewAuth(
  request: Request,
  config: PreviewAuthConfig,
  db: D1Database,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname === '/api/health' && request.method === 'GET') return null
  if (!config.sessionSecret) {
    return configErrorResponse(
      'PREVIEW_SESSION_SECRET が設定されていません',
      'プレビューを利用できません',
    )
  }

  const routed = await handleAuthRoutes(request, authConfig(config), db, hooks)
  if (routed) return routed

  if (await requireSession(request, authConfig(config), db, hooks)) return null
  return loginPageResponse(authConfig(config))
}
