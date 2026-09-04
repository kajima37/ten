import { z } from 'zod'

export const envConfigSchema = z
  .object({
    PREVIEW_MODE: z.enum(['required', 'disabled']).optional(),
    DEPLOY_VERSION: z.string().min(1).optional(),
    LEGAL_DEVELOPER_NAME: z.string().min(1).optional(),
    LEGAL_CONTACT_EMAIL: z.string().email().optional(),
    AUTH_SECRET: z.string().min(1),
    PREVIEW_SESSION_SECRET: z.string().min(1).optional(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
    GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .superRefine((config, ctx) => {
    const hasPreviewBindings = Boolean(
      config.PREVIEW_SESSION_SECRET ||
      config.GOOGLE_OAUTH_CLIENT_ID ||
      config.GOOGLE_OAUTH_CLIENT_SECRET ||
      config.GITHUB_OAUTH_CLIENT_ID ||
      config.GITHUB_OAUTH_CLIENT_SECRET,
    )
    if (hasPreviewBindings && config.PREVIEW_MODE !== 'required') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PREVIEW_MODE'],
        message: 'must be "required" when preview bindings are present',
      })
    }
    if (config.PREVIEW_MODE === 'required') {
      if (!config.PREVIEW_SESSION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PREVIEW_SESSION_SECRET'],
          message: 'required when PREVIEW_MODE is required',
        })
      }
      if (
        !config.GITHUB_OAUTH_CLIENT_ID ||
        !config.GITHUB_OAUTH_CLIENT_SECRET
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GITHUB_OAUTH_CLIENT'],
          message:
            'GitHub OAuth credentials are required when PREVIEW_MODE is required',
        })
      }
    }
    const hasGoogleId = Boolean(config.GOOGLE_OAUTH_CLIENT_ID)
    const hasGoogleSecret = Boolean(config.GOOGLE_OAUTH_CLIENT_SECRET)
    if (hasGoogleId !== hasGoogleSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_OAUTH_CLIENT'],
        message: 'Google OAuth Client ID and Secret must be set together',
      })
    }
  })

export type RuntimeEnv = z.input<typeof envConfigSchema>

export type PreviewMode = 'required' | 'disabled' | 'unset'

export type OAuthProviderConfig = { clientId: string; clientSecret: string }

export type PreviewAuthConfig = {
  sessionSecret: string | null
  github: OAuthProviderConfig | null
  google: OAuthProviderConfig | null
}

export type ParsedEnv = {
  previewMode: PreviewMode
  deployVersion: string | null
  authSecret: string
  preview: PreviewAuthConfig
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
      previewMode: value.PREVIEW_MODE ?? 'unset',
      deployVersion: value.DEPLOY_VERSION ?? null,
      authSecret: value.AUTH_SECRET,
      preview: {
        sessionSecret: value.PREVIEW_SESSION_SECRET ?? null,
        github,
        google,
      },
    },
  }
}
