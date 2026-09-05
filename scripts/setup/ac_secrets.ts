import type { SetupConfig, StepResult } from './types.ts'
import { printBlock } from './prompt.ts'
import { collectSopsFields } from './sops.ts'
import type { SopsField } from './sops.ts'

function gen(
  key: string,
  label: string,
  required: boolean,
  sensitive: boolean,
): SopsField {
  return { key, label, required, kind: sensitive ? 'password' : 'text' }
}

function genSecret(key: string, label: string): SopsField {
  return { key, label, required: true, kind: 'generate' }
}

const STAGING_FIELDS: SopsField[] = [
  gen('CLOUDFLARE_API_TOKEN', 'Cloudflare API Token', true, true),
  gen('CLOUDFLARE_ACCOUNT_ID', 'Cloudflare Account ID', true, false),
  genSecret('AUTH_SECRET', 'Auth Secret (JWT 署名鍵)'),
  genSecret('ADMIN_SESSION_SECRET', 'Admin Session Secret'),
  genSecret('PREVIEW_SESSION_SECRET', 'Preview Session Secret'),
  gen('GITHUB_OAUTH_CLIENT_ID', 'GitHub OAuth Client ID', true, false),
  gen('GITHUB_OAUTH_CLIENT_SECRET', 'GitHub OAuth Client Secret', true, true),
  gen('GOOGLE_OAUTH_CLIENT_ID', 'Google OAuth Client ID (任意)', false, false),
  gen(
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'Google OAuth Client Secret (任意)',
    false,
    true,
  ),
]

const PRODUCTION_FIELDS: SopsField[] = [
  gen('CLOUDFLARE_API_TOKEN', 'Cloudflare API Token (production)', true, true),
  gen(
    'CLOUDFLARE_ACCOUNT_ID',
    'Cloudflare Account ID (production)',
    true,
    false,
  ),
  genSecret(
    'AUTH_SECRET',
    'Auth Secret (production, staging と同一にしないこと)',
  ),
  genSecret('ADMIN_SESSION_SECRET', 'Admin Session Secret (production)'),
  gen(
    'GITHUB_OAUTH_CLIENT_ID',
    'GitHub OAuth Client ID (production, staging とは別 App)',
    true,
    false,
  ),
  gen(
    'GITHUB_OAUTH_CLIENT_SECRET',
    'GitHub OAuth Client Secret (production)',
    true,
    true,
  ),
  gen(
    'GOOGLE_OAUTH_CLIENT_ID',
    'Google OAuth Client ID (production, 任意)',
    false,
    false,
  ),
  gen(
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'Google OAuth Client Secret (production, 任意)',
    false,
    true,
  ),
]

export async function runSecretsStep(config: SetupConfig): Promise<StepResult> {
  printBlock('シークレット登録', [
    '各シークレットの値を対話式に入力します。',
    '入力された値は SOPS で暗号化してディスクに書き込みます。',
    '空のまま Enter で任意フィールドをスキップできます。',
    '',
    '必須: Cloudflare API Token, Account ID, OAuth クレデンシャル',
    '任意: Google OAuth クレデンシャル (未使用ならスキップ)',
  ])

  await collectSopsFields(
    'Staging シークレット',
    'secrets.staging.age.env',
    STAGING_FIELDS,
    config,
  )
  await collectSopsFields(
    'Production シークレット',
    'secrets.production.age.env',
    PRODUCTION_FIELDS,
    config,
  )

  return {
    step: 'secrets',
    status: 'completed',
    message: 'シークレットを登録しました',
  }
}
