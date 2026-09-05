import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execaSync } from 'execa'
import type { SetupConfig } from './types.ts'
import { confirm, input } from './prompt.ts'

export const SECRETS_DIR = 'secrets'

export type SopsFieldKind =
  'text' | 'password' | 'generate' | 'base64-file' | 'raw-file'

export interface SopsField {
  key: string
  label: string
  required: boolean
  kind: SopsFieldKind
  hint?: string
}

function ageKeyForEnvFile(envFile: string): string {
  const keyName = envFile.startsWith('secrets.staging.')
    ? 'staging.agekey'
    : 'production.agekey'
  const keyPath = path.join(process.cwd(), SECRETS_DIR, '.private', keyName)
  return fs.readFileSync(keyPath, 'utf8').trim()
}

export function writeSopsEnvFile(
  envFile: string,
  values: Record<string, string>,
): void {
  const lines =
    Object.entries(values)
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n'

  const secretsDir = path.join(process.cwd(), SECRETS_DIR)
  const outputPath = path.join(secretsDir, envFile)

  const { stdout } = execaSync(
    'sops',
    [
      'encrypt',
      '--input-type',
      'dotenv',
      '--output-type',
      'dotenv',
      '--filename-override',
      envFile,
    ],
    {
      input: lines,
      cwd: secretsDir,
      env: { ...process.env, SOPS_AGE_KEY: ageKeyForEnvFile(envFile) },
      timeout: 10_000,
    },
  )
  fs.writeFileSync(outputPath, stdout)
}

export function readExistingValues(envFile: string): Record<string, string> {
  const envPath = path.join(process.cwd(), SECRETS_DIR, envFile)
  if (!fs.existsSync(envPath)) return {}

  try {
    const { stdout } = execaSync(
      'sops',
      ['decrypt', '--input-type', 'dotenv', '--output-type', 'dotenv', envFile],
      {
        cwd: path.join(process.cwd(), SECRETS_DIR),
        env: { ...process.env, SOPS_AGE_KEY: ageKeyForEnvFile(envFile) },
        timeout: 10_000,
      },
    )
    const values: Record<string, string> = {}
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const value = trimmed.slice(eqIndex + 1)
      if (value !== '<set-me>') {
        values[trimmed.slice(0, eqIndex)] = value
      }
    }
    return values
  } catch {
    return {}
  }
}

function base64File(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ファイルが見つかりません: ${filePath}`)
  }
  const buf = fs.readFileSync(filePath)
  if (buf.length === 0) {
    throw new Error(`ファイルが空です: ${filePath}`)
  }
  return buf.toString('base64')
}

function rawFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ファイルが見つかりません: ${filePath}`)
  }
  const content = fs.readFileSync(filePath, 'utf8').trim()
  if (!content) {
    throw new Error(`ファイルが空です: ${filePath}`)
  }
  return content
}

async function collectFieldValue(
  field: SopsField,
  current: string | undefined,
): Promise<string> {
  const isFileKind = field.kind === 'base64-file' || field.kind === 'raw-file'

  if (field.kind === 'generate' && !current) {
    const suggested = crypto.randomBytes(32).toString('hex')
    const useGenerated = await confirm(
      `  ${field.label} の自動生成値を使いますか?`,
      true,
    )
    if (useGenerated) return suggested
  }

  if (isFileKind) {
    const filePath = await input(
      `  ${field.label} (ファイルパス)` + (field.hint ? ` ${field.hint}` : ''),
    )
    if (!filePath) return current ?? ''
    const raw =
      field.kind === 'base64-file' ? base64File(filePath) : rawFile(filePath)
    console.log(
      `    取得完了: ${field.label} (${fs.statSync(filePath).size} bytes)`,
    )
    return raw
  }

  const value = await input(`  ${field.label}`, {
    mask: field.kind === 'password',
    defaultValue:
      field.kind === 'text' || field.kind === 'password' ? current : undefined,
  })
  return value || current || ''
}

export async function collectSopsFields(
  label: string,
  envFile: string,
  fields: SopsField[],
  config: SetupConfig,
): Promise<void> {
  console.log()
  console.log(`  -- ${label} --`)

  if (config.dryRun) {
    console.log(`  書き込み予定: ${SECRETS_DIR}/${envFile}`)
    return
  }

  const existing = readExistingValues(envFile)
  const values: Record<string, string> = { ...existing }

  if (Object.keys(existing).length > 0) {
    console.log(
      `  既存の値を検出しました (${Object.keys(existing).length} キー)`,
    )
    if (config.interactive) {
      const keep = await confirm(
        '  既存の値を保持して、未設定のもののみ入力しますか?',
        true,
      )
      if (!keep) {
        for (const key of Object.keys(existing)) {
          delete values[key]
        }
      }
    }
  }

  if (!config.interactive) {
    console.log('  非対話モードのためスキップします')
    console.log(`  手動で編集: sops ${SECRETS_DIR}/${envFile}`)
    return
  }

  for (const field of fields) {
    const current = values[field.key]
    if (current) {
      const masked =
        field.kind === 'password' ? current.slice(0, 4) + '***' : '(設定済み)'
      console.log(`  ${field.label}: ${masked}`)
      const change = await confirm('    変更しますか?')
      if (!change) continue
    }

    const value = await collectFieldValue(field, current)
    if (value) {
      values[field.key] = value
    } else if (!field.required) {
      console.log('    (スキップ)')
    }
  }

  writeSopsEnvFile(envFile, values)
  console.log(`  書き込み完了: ${SECRETS_DIR}/${envFile}`)
}
