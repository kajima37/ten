import * as fs from 'node:fs'
import * as path from 'node:path'
import { execaSync } from 'execa'
import type { SetupConfig, SetupState, StepResult } from './types.ts'
import { confirm } from './prompt.ts'

const PRIVATE_DIR = 'secrets/.private'
const SOPS_CONFIG = 'secrets/.sops.yaml'

function generateKey(outputPath: string): {
  privateKeyPath: string
  publicKey: string
} {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  execaSync('age-keygen', ['-o', outputPath], { timeout: 10_000 })
  const { stdout } = execaSync('age-keygen', ['-y', outputPath], {
    timeout: 5_000,
  })

  return { privateKeyPath: outputPath, publicKey: stdout.trim() }
}

function updateSopsConfig(
  stagingKey: string | undefined,
  productionKey: string | undefined,
): void {
  const configPath = path.join(process.cwd(), SOPS_CONFIG)
  let content = fs.readFileSync(configPath, 'utf8')

  if (stagingKey) {
    content = content.replace(
      /age: age1[a-z0-9]+\n(\s+path_regex: secrets\.staging)/,
      `age: ${stagingKey}\n$1`,
    )
  }
  if (productionKey) {
    const prodPattern =
      /age: age1[a-z0-9]+\n(\s+path_regex: secrets\.(production|android-release|ios-release))/
    if (prodPattern.test(content)) {
      content = content.replace(prodPattern, `age: ${productionKey}\n$1`)
    }
  }

  fs.writeFileSync(configPath, content)
}

function keyExists(privateKeyPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), privateKeyPath))
}

export async function runKeysStep(
  config: SetupConfig,
  _state: SetupState,
): Promise<StepResult> {
  const stagingPath = path.join(PRIVATE_DIR, 'staging.agekey')
  const productionPath = path.join(PRIVATE_DIR, 'production.agekey')

  const stagingExists = keyExists(stagingPath)
  const productionExists = keyExists(productionPath)

  if (stagingExists && productionExists && !config.dryRun) {
    console.log('  暗号鍵が既に存在します:')
    console.log(`    - ${stagingPath}`)
    console.log(`    - ${productionPath}`)

    if (config.interactive) {
      const overwrite = await confirm('  既存の鍵を上書きしますか?')
      if (!overwrite) {
        return {
          step: 'keys',
          status: 'skipped',
          message: '既存の鍵を保持します',
        }
      }
    } else {
      return {
        step: 'keys',
        status: 'skipped',
        message: '既存の鍵を保持します (非対話モード)',
      }
    }
  }

  if (config.dryRun) {
    console.log(`  生成予定: ${stagingPath}`)
    console.log(`  生成予定: ${productionPath}`)
    return {
      step: 'keys',
      status: 'completed',
      message: 'dry run: 鍵を生成しませんでした',
    }
  }

  console.log('  Staging 鍵を生成中...')
  const staging = generateKey(path.join(process.cwd(), stagingPath))
  console.log(`    秘密鍵: ${stagingPath}`)
  console.log(`    公開鍵: ${staging.publicKey}`)

  console.log('  Production 鍵を生成中...')
  const production = generateKey(path.join(process.cwd(), productionPath))
  console.log(`    秘密鍵: ${productionPath}`)
  console.log(`    公開鍵: ${production.publicKey}`)

  console.log('  secrets/.sops.yaml を更新中...')
  updateSopsConfig(staging.publicKey, production.publicKey)

  return {
    step: 'keys',
    status: 'completed',
    message: '暗号鍵を生成し .sops.yaml を更新しました',
  }
}
