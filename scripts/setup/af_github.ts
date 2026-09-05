import * as fs from 'node:fs'
import * as path from 'node:path'
import { execaSync } from 'execa'
import type { SetupConfig, StepResult } from './types.ts'
import { confirm } from './prompt.ts'
import { readJsonc } from './jsonc.ts'

const WORKER_WRANGLER = 'apps/worker/wrangler.jsonc'
const ADMIN_WRANGLER = 'apps/admin/wrangler.jsonc'

function readWorkerNames(): {
  stagingApi: string
  productionApi: string
  stagingAdmin: string
  productionAdmin: string
} {
  const worker = readJsonc(WORKER_WRANGLER)
  const admin = readJsonc(ADMIN_WRANGLER)
  return {
    stagingApi: worker.env.staging.name,
    productionApi: worker.env.production.name,
    stagingAdmin: admin.env.staging.name,
    productionAdmin: admin.env.production.name,
  }
}

function readAgeKey(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8').trim()
}

function getRepoSlug(): string {
  const { stdout } = execaSync('git', ['remote', 'get-url', 'origin'], {
    timeout: 5_000,
  })
  const match = stdout.trim().match(/github\.com[:/](.+?)(?:\.git)?$/)
  if (!match?.[1]) {
    throw new Error('GitHub リポジトリ URL を取得できませんでした')
  }
  return match[1]
}

function ghApi(args: string[]): string {
  return execaSync('gh', ['api', ...args], { timeout: 30_000 }).stdout.trim()
}

function ghSecretSet(env: string, name: string, value: string): void {
  execaSync('gh', ['secret', 'set', name, '--env', env], {
    input: value,
    timeout: 15_000,
  })
}

function ghVariableSet(env: string, name: string, value: string): void {
  execaSync('gh', ['variable', 'set', name, '--env', env, '--body', value], {
    timeout: 15_000,
  })
}

function createEnvironment(repoSlug: string, env: string): void {
  ghApi([
    'repos',
    `${repoSlug}/environments/${env}`,
    '-X',
    'PUT',
    '-f',
    'wait_timer=0',
    '-f',
    'reviewers=[]',
  ])
}

function enablePages(repoSlug: string): void {
  try {
    ghApi([
      'repos',
      `${repoSlug}/pages`,
      '-X',
      'POST',
      '-f',
      'build_type=workflow',
    ])
    console.log('  [ok] GitHub Pages を有効にしました')
  } catch {
    console.log('  [skip] GitHub Pages は既に有効です')
  }
}

function environmentExists(repoSlug: string, env: string): boolean {
  try {
    ghApi(['repos', `${repoSlug}/environments/${env}`])
    return true
  } catch {
    return false
  }
}

export async function runGithubStep(config: SetupConfig): Promise<StepResult> {
  const repoSlug = getRepoSlug()
  const names = readWorkerNames()
  const stagingApiUrl = `https://${names.stagingApi}.workers.dev`
  const productionApiUrl = `https://${names.productionApi}.workers.dev`
  const stagingAdminUrl = `https://${names.stagingAdmin}.workers.dev`
  const productionAdminUrl = `https://${names.productionAdmin}.workers.dev`

  console.log(`  リポジトリ: ${repoSlug}`)
  console.log(`  Staging API:    ${stagingApiUrl}`)
  console.log(`  Production API: ${productionApiUrl}`)

  if (config.dryRun) {
    console.log('  [dry-run] GitHub Environments と Pages を設定します')
    return {
      step: 'github',
      status: 'completed',
      message: 'dry run: GitHub 設定をスキップ',
    }
  }

  const stagingKey = readAgeKey('secrets/.private/staging.agekey')
  const productionKey = readAgeKey('secrets/.private/production.agekey')

  const environments = [
    {
      name: 'staging',
      secret: stagingKey,
      variables: { TEN_API_URL: stagingApiUrl, TEN_ADMIN_URL: stagingAdminUrl },
    },
    {
      name: 'production',
      secret: productionKey,
      variables: {
        TEN_API_URL: productionApiUrl,
        TEN_ADMIN_URL: productionAdminUrl,
      },
    },
    {
      name: 'release',
      secret: productionKey,
      variables: { TEN_API_URL: productionApiUrl },
    },
  ]

  for (const env of environments) {
    const exists = environmentExists(repoSlug, env.name)
    if (exists && !config.interactive) {
      console.log(`  [skip] ${env.name} は既に存在します`)
      continue
    }
    if (exists) {
      const overwrite = await confirm(
        `  ${env.name} は既に存在します。上書きしますか?`,
      )
      if (!overwrite) {
        console.log(`  [skip] ${env.name} をスキップ`)
        continue
      }
    }

    console.log(
      `  [${exists ? '更新' : '作成'}] GitHub Environment: ${env.name}`,
    )
    createEnvironment(repoSlug, env.name)

    console.log('    SOPS_AGE_KEY を設定中...')
    ghSecretSet(env.name, 'SOPS_AGE_KEY', env.secret)

    for (const [key, value] of Object.entries(env.variables)) {
      console.log(`    ${key} を設定中...`)
      ghVariableSet(env.name, key, value)
    }
  }

  console.log('  GitHub Pages を有効化中...')
  enablePages(repoSlug)

  return {
    step: 'github',
    status: 'completed',
    message: 'GitHub Environments と Pages を設定しました',
  }
}
