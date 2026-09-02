import { z } from 'zod'

export const envConfigSchema = z
  .object({
    ENVIRONMENT: z.enum(['staging', 'production']),
    DEPLOY_VERSION: z.string().min(1).optional(),
    ADMIN_SESSION_SECRET: z.string().min(1),
    GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
    GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .superRefine((config, ctx) => {
    const hasGoogleId = Boolean(config.GOOGLE_OAUTH_CLIENT_ID)
    const hasGoogleSecret = Boolean(config.GOOGLE_OAUTH_CLIENT_SECRET)
    if (hasGoogleId !== hasGoogleSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_OAUTH_CLIENT'],
        message: 'Google OAuth Client ID and Secret must be set together',
      })
    }
    const hasGithubId = Boolean(config.GITHUB_OAUTH_CLIENT_ID)
    const hasGithubSecret = Boolean(config.GITHUB_OAUTH_CLIENT_SECRET)
    if (hasGithubId !== hasGithubSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GITHUB_OAUTH_CLIENT'],
        message: 'GitHub OAuth Client ID and Secret must be set together',
      })
    }
    const hasProvider = Boolean(hasGoogleId || hasGithubId)
    if (!hasProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OAUTH_CLIENT'],
        message: 'At least one OAuth provider must be configured',
      })
    }
  })

export type RuntimeEnv = z.input<typeof envConfigSchema>

export type AdminEnvironment = 'staging' | 'production'

export type OAuthProviderConfig = { clientId: string; clientSecret: string }

export type ParsedEnv = {
  environment: AdminEnvironment
  deployVersion: string | null
  sessionSecret: string
  google: OAuthProviderConfig | null
  github: OAuthProviderConfig | null
}

export type EnvValidationResult =
  | { ok: true; config: ParsedEnv }
  | { ok: false; issues: Array<{ path: string; message: string }> }

export function parseEnv(env: RuntimeEnv): EnvValidationResult {
  const result = envConfigSchema.safeParse(env)
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'config',
        message: issue.message,
      })),
    }
  }
  const value = result.data
  const github =
    value.GITHUB_OAUTH_CLIENT_ID && value.GITHUB_OAUTH_CLIENT_SECRET
      ? {
          clientId: value.GITHUB_OAUTH_CLIENT_ID,
          clientSecret: value.GITHUB_OAUTH_CLIENT_SECRET,
        }
      : null
  const google =
    value.GOOGLE_OAUTH_CLIENT_ID && value.GOOGLE_OAUTH_CLIENT_SECRET
      ? {
          clientId: value.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: value.GOOGLE_OAUTH_CLIENT_SECRET,
        }
      : null
  return {
    ok: true,
    config: {
      environment: value.ENVIRONMENT,
      deployVersion: value.DEPLOY_VERSION ?? null,
      sessionSecret: value.ADMIN_SESSION_SECRET,
      github,
      google,
    },
  }
}
