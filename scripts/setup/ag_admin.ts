import { execaSync } from 'execa'
import type { SetupConfig, StepResult } from './types.ts'
import { confirm } from './prompt.ts'

function getGitHubUserId(): string {
  const { stdout } = execaSync('gh', ['api', 'user', '--jq', '.id'], {
    timeout: 15_000,
  })
  const output = stdout.trim()
  if (!output || Number.isNaN(Number(output))) {
    throw new Error('GitHub user ID を取得できませんでした')
  }
  return output
}

function getGitHubUsername(): string {
  return execaSync('gh', ['api', 'user', '--jq', '.login'], {
    timeout: 15_000,
  }).stdout.trim()
}

function runWranglerMigrations(env: string): void {
  console.log(`  D1 マイグレーションを適用中 (${env})...`)
  execaSync(
    'pnpm',
    [
      '--filter',
      '@ten/worker',
      'exec',
      'wrangler',
      'd1',
      'migrations',
      'apply',
      `ten-db-${env}`,
      '--remote',
      '--env',
      env,
    ],
    { timeout: 60_000 },
  )
  console.log(`  [ok] マグレーション適用完了 (${env})`)
}

function bootstrapAdmin(userId: string): void {
  const sql = `INSERT INTO admin_identities (provider, subject, approved_at, approved_by) VALUES ('github', '${userId}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'initial-bootstrap')`
  execaSync(
    'pnpm',
    [
      '--filter',
      '@ten/admin',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'ten-db-production',
      '--remote',
      '--env',
      'production',
      '--command',
      sql,
    ],
    { timeout: 30_000 },
  )
}

function adminExists(): boolean {
  try {
    const { stdout } = execaSync(
      'pnpm',
      [
        '--filter',
        '@ten/admin',
        'exec',
        'wrangler',
        'd1',
        'execute',
        'ten-db-production',
        '--remote',
        '--env',
        'production',
        '--command',
        'SELECT count(*) as cnt FROM admin_identities WHERE approved_at IS NOT NULL',
        '--json',
      ],
      { timeout: 30_000 },
    )
    const parsed = JSON.parse(stdout) as Array<{
      result: Array<{ rows: Array<{ cnt: number }> }>
    }>
    const cnt = parsed[0]?.result[0]?.rows[0]?.cnt ?? 0
    return cnt > 0
  } catch {
    return false
  }
}

export async function runAdminStep(config: SetupConfig): Promise<StepResult> {
  if (config.dryRun) {
    console.log(
      '  [dry-run] D1 マイグレーションと Admin Bootstrap を実行します',
    )
    return {
      step: 'admin',
      status: 'completed',
      message: 'dry run: Admin 設定をスキップ',
    }
  }

  runWranglerMigrations('staging')
  runWranglerMigrations('production')

  if (adminExists()) {
    console.log('  [skip] 承認済み管理者が既に存在します')
    return {
      step: 'admin',
      status: 'completed',
      message: '管理者は既に登録済みです',
    }
  }

  console.log('  管理者を登録中...')
  const username = getGitHubUsername()
  const userId = getGitHubUserId()
  console.log(`    GitHub ユーザー: ${username} (ID: ${userId})`)

  if (config.interactive) {
    const proceed = await confirm(
      '  このユーザーを初回管理者として登録しますか?',
    )
    if (!proceed) {
      return {
        step: 'admin',
        status: 'skipped',
        message: '管理者登録をスキップしました',
      }
    }
  }

  bootstrapAdmin(userId)
  console.log(`  [ok] 管理者 ${username} を登録しました`)

  return {
    step: 'admin',
    status: 'completed',
    message: '管理者が登録されました',
  }
}
