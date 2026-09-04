import { execaSync } from 'execa'
import type { SetupConfig, SetupState, StepResult } from './types.ts'
import { confirm } from './prompt.ts'
import { updateJsonc } from './jsonc.ts'

const WORKER_WRANGLER = 'apps/worker/wrangler.jsonc'
const ADMIN_WRANGLER = 'apps/admin/wrangler.jsonc'

function extractId(output: string, pattern: RegExp): string {
  const match = output.match(pattern)
  if (!match?.[1]) {
    throw new Error(`ID を抽出できませんでした: ${output}`)
  }
  return match[1]
}

function isWranglerLoggedIn(): boolean {
  try {
    execaSync(
      'pnpm',
      ['--filter', '@ten/worker', 'exec', 'wrangler', 'whoami'],
      {
        timeout: 15_000,
      },
    )
    return true
  } catch {
    return false
  }
}

function createD1Database(name: string): string {
  const { stdout } = execaSync(
    'pnpm',
    ['--filter', '@ten/worker', 'exec', 'wrangler', 'd1', 'create', name],
    { timeout: 60_000 },
  )
  console.log(stdout)
  return extractId(stdout, /database_id["\s:]+([a-f0-9-]+)/i)
}

function createKVNamespace(title: string): string {
  const { stdout } = execaSync(
    'pnpm',
    [
      '--filter',
      '@ten/worker',
      'exec',
      'wrangler',
      'kv',
      'namespace',
      'create',
      title,
    ],
    { timeout: 60_000 },
  )
  console.log(stdout)
  return extractId(stdout, /id["\s:]+([a-f0-9]+)/i)
}

export async function runCloudflareStep(
  config: SetupConfig,
  _state: SetupState,
): Promise<StepResult> {
  if (!isWranglerLoggedIn()) {
    console.log('  Cloudflare に未ログインです。')
    if (config.interactive) {
      const doLogin = await confirm('  wrangler login を実行しますか?')
      if (doLogin) {
        console.log('  ブラウザで Cloudflare ログインを行います...')
        execaSync(
          'pnpm',
          ['--filter', '@ten/worker', 'exec', 'wrangler', 'login'],
          {
            stdio: 'inherit',
            timeout: 120_000,
          },
        )
      } else {
        return {
          step: 'cloudflare',
          status: 'failed',
          message: 'wrangler login が必要です',
        }
      }
    } else {
      return {
        step: 'cloudflare',
        status: 'failed',
        message: 'wrangler が未認証です (非対話モード)',
      }
    }
  } else {
    console.log('  [ok] Wrangler 認証済み')
  }

  if (config.dryRun) {
    console.log('  作成予定: D1 データベース (staging, production)')
    console.log('  作成予定: KV 名前空間 (staging, production)')
    console.log(`  更新予定: ${WORKER_WRANGLER}`)
    console.log(`  更新予定: ${ADMIN_WRANGLER}`)
    return {
      step: 'cloudflare',
      status: 'completed',
      message: 'dry run: Cloudflare リソースを作成しませんでした',
    }
  }

  const existing = _state.cloudflare
  let stagingDbId = existing?.stagingDatabaseId
  let productionDbId = existing?.productionDatabaseId
  let stagingKVId = existing?.stagingKVId
  let productionKVId = existing?.productionKVId

  if (!stagingDbId) {
    console.log('  Staging D1 データベースを作成中...')
    stagingDbId = createD1Database('ten-db-staging')
    console.log(`    id: ${stagingDbId}`)
  } else {
    console.log(`  [skip] Staging D1 は既に存在します: ${stagingDbId}`)
  }

  if (!productionDbId) {
    console.log('  Production D1 データベースを作成中...')
    productionDbId = createD1Database('ten-db-production')
    console.log(`    id: ${productionDbId}`)
  } else {
    console.log(`  [skip] Production D1 は既に存在します: ${productionDbId}`)
  }

  if (!stagingKVId) {
    console.log('  Staging KV 名前空間を作成中...')
    stagingKVId = createKVNamespace('DAILY_CACHE_STAGING')
    console.log(`    id: ${stagingKVId}`)
  } else {
    console.log(`  [skip] Staging KV は既に存在します: ${stagingKVId}`)
  }

  if (!productionKVId) {
    console.log('  Production KV 名前空間を作成中...')
    productionKVId = createKVNamespace('DAILY_CACHE_PRODUCTION')
    console.log(`    id: ${productionKVId}`)
  } else {
    console.log(`  [skip] Production KV は既に存在します: ${productionKVId}`)
  }

  console.log(`  ${WORKER_WRANGLER} を更新中...`)
  updateJsonc(WORKER_WRANGLER, (cfg) => {
    const staging = cfg.env.staging
    const db = staging.d1_databases.find(
      (d) => d.database_name === 'ten-db-staging',
    )
    if (db) db.database_id = stagingDbId
    const kv = staging.kv_namespaces?.find((k) => k.binding === 'DAILY_CACHE')
    if (kv) kv.id = stagingKVId
    const production = cfg.env.production
    const pdb = production.d1_databases.find(
      (d) => d.database_name === 'ten-db-production',
    )
    if (pdb) pdb.database_id = productionDbId
    const pkv = production.kv_namespaces?.find(
      (k) => k.binding === 'DAILY_CACHE',
    )
    if (pkv) pkv.id = productionKVId
    return cfg
  })

  console.log(`  ${ADMIN_WRANGLER} を更新中...`)
  updateJsonc(ADMIN_WRANGLER, (cfg) => {
    const staging = cfg.env.staging
    const db = staging.d1_databases.find(
      (d) => d.database_name === 'ten-db-staging',
    )
    if (db) db.database_id = stagingDbId
    const production = cfg.env.production
    const pdb = production.d1_databases.find(
      (d) => d.database_name === 'ten-db-production',
    )
    if (pdb) pdb.database_id = productionDbId
    return cfg
  })

  return {
    step: 'cloudflare',
    status: 'completed',
    message: 'Cloudflare リソースを作成し wrangler 設定を更新しました',
  }
}
