import { execaSync } from 'execa'
import type { SetupConfig, StepResult } from './types.ts'
import { confirm } from './prompt.ts'
import { readJsonc } from './jsonc.ts'

const WORKER_WRANGLER = 'apps/worker/wrangler.jsonc'

function getStagingApiUrl(): string {
  const config = readJsonc(WORKER_WRANGLER)
  return `https://${config.env.staging.name}.workers.dev`
}

function getHeadSha(): string {
  return execaSync('git', ['rev-parse', 'HEAD'], {
    timeout: 5_000,
  }).stdout.trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHealthCheck(
  url: string,
  timeoutSeconds: number,
): Promise<{ ok: boolean; version: string }> {
  const deadline = Date.now() + timeoutSeconds * 1000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) {
        const parsed = (await response.json()) as { version?: string }
        if (parsed.version) {
          return { ok: true, version: parsed.version }
        }
      }
    } catch {
      // health check failed, retry
    }
    await sleep(5_000)
  }
  return { ok: false, version: '' }
}

export async function runDeployStep(config: SetupConfig): Promise<StepResult> {
  const apiUrl = getStagingApiUrl()
  const headSha = getHeadSha()

  console.log(`  Staging API: ${apiUrl}`)
  console.log(`  コミット: ${headSha.slice(0, 7)}`)

  if (config.dryRun) {
    console.log('  [dry-run] git push とヘルスチェックをスキップ')
    return {
      step: 'deploy',
      status: 'completed',
      message: 'dry run: デプロイをスキップ',
    }
  }

  if (config.interactive) {
    const proceed = await confirm(
      '  main ブランチにプッシュしてステージングデプロイを開始しますか?',
    )
    if (!proceed) {
      return {
        step: 'deploy',
        status: 'skipped',
        message: 'デプロイをスキップしました',
      }
    }
  }

  console.log('  main ブランチにプッシュ中...')
  execaSync('git', ['push', 'origin', 'main'], { timeout: 30_000 })
  console.log('  [ok] プッシュ完了')

  console.log('  CI パイプラインの完了を待機中... (最大 5 分)')
  const result = await waitForHealthCheck(apiUrl, 300)

  if (result.ok) {
    console.log(
      `  [ok] ヘルスチェック通過 (version: ${result.version.slice(0, 7)})`,
    )
    return {
      step: 'deploy',
      status: 'completed',
      message: 'ステージングデプロイが完了しました',
    }
  }

  console.log('  [!] ヘルスチェックがタイムアウトしました')
  console.log('      GitHub Actions を確認してください:')
  console.log('      https://github.com/actions')
  return {
    step: 'deploy',
    status: 'failed',
    message: 'ヘルスチェックがタイムアウトしました',
  }
}
