import {
  isAdminIdentityAllowed,
  isPreviewIdentityAllowed,
  upsertAdminIdentity,
  upsertPreviewIdentity,
} from '@ten/oauth'
import type { OAuthAppConfig, OAuthHooks, OAuthIdentity } from '@ten/oauth'

import type { ParsedEnv } from './env.ts'

export const SESSION_COOKIE = '__Host-ten-admin-session'
export const OAUTH_COOKIE_PREFIX = '__Host-ten-admin-oauth-'

export function oauthConfig(config: ParsedEnv): OAuthAppConfig {
  return {
    sessionSecret: config.sessionSecret,
    google: config.google,
    github: config.github,
    sessionCookieName: SESSION_COOKIE,
    oauthCookiePrefix: OAUTH_COOKIE_PREFIX,
    loginTitle: 'TEN. admin',
    loginHeading: 'TEN. 管理画面',
    loginDescription: '許可された管理者アカウントでログインしてください。',
    unapprovedHeading: '管理者として未承認です',
    unapprovedDescription: '運用管理者へ次の識別子を連絡してください。',
  }
}

export function adminHooks(environment: ParsedEnv['environment']): OAuthHooks {
  if (environment === 'production') {
    return {
      recordIdentity: upsertAdminIdentity,
      isAllowed: isAdminIdentityAllowed,
    }
  }
  return {
    recordIdentity: upsertPreviewIdentity,
    isAllowed: isPreviewIdentityAllowed,
  }
}

export function identityLabel(identity: OAuthIdentity): string {
  return `${identity.provider}:${identity.subject}`
}
