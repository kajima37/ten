import type { StepResult } from './types.ts'
import { printBlock } from './prompt.ts'

export async function runInstructionsStep(): Promise<StepResult> {
  printBlock('残りの手動手順 (OAuth Apps)', [
    'GitHub Environments、Pages、Admin Bootstrap、デプロイは',
    'すべて自動設定済みです。残りは OAuth Apps のみです。',
    '',
    '---',
    '',
    '1. Staging GitHub OAuth App',
    '',
    '   GitHub > Settings > Developer settings > OAuth Apps > New OAuth App',
    '   Authorization callback URL:',
    '     https://ten-api-staging.<account>.workers.dev/auth/callback/github',
    '     https://ten-admin-staging.<account>.workers.dev/auth/callback/github',
    '',
    '2. Staging Google OAuth Client (任意)',
    '',
    '   Google Cloud Console > APIs & Services > Credentials',
    '   Authorized redirect URIs:',
    '     https://ten-api-staging.<account>.workers.dev/auth/callback/google',
    '     https://ten-admin-staging.<account>.workers.dev/auth/callback/google',
    '',
    '3. Production GitHub OAuth App (staging とは別に作成)',
    '',
    '   GitHub > Settings > Developer settings > OAuth Apps > New OAuth App',
    '   Authorization callback URL:',
    '     https://ten-admin-production.<account>.workers.dev/auth/callback/github',
    '     https://ten-admin-production.<account>.workers.dev/auth/callback/google',
    '',
    '4. Client ID / Secret の登録',
    '',
    '   作成した OAuth App の Client ID / Secret を取得したら、',
    '   このツールのシークレット登録ステップを再実行してください:',
    '     pnpm setup --only secrets',
    '',
    '   既存の値は保持され、未設定の OAuth キーのみ入力できます。',
    '   (GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET,',
    '    GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET)',
    '',
    '---',
    '',
    '詳細: docs/deployment/setup.md',
  ])

  return {
    step: 'instructions',
    status: 'manual_required',
    message: 'OAuth Apps の手動登録とシークレット再設定が必要です',
  }
}
