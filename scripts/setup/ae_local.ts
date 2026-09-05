import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SetupConfig, StepResult } from './types.ts'
import { confirm } from './prompt.ts'

const DEV_VARS_PATH = 'apps/worker/.dev.vars'

const DEFAULT_CONTENT = `PREVIEW_MODE=disabled
`

export async function runLocalStep(config: SetupConfig): Promise<StepResult> {
  const fullPath = path.join(process.cwd(), DEV_VARS_PATH)
  const exists = fs.existsSync(fullPath)

  if (exists) {
    console.log(`  ${DEV_VARS_PATH} が既に存在します`)
    if (config.interactive) {
      const overwrite = await confirm('  上書きしますか?')
      if (!overwrite) {
        return {
          step: 'local',
          status: 'skipped',
          message: '既存の .dev.vars を保持します',
        }
      }
    } else {
      return {
        step: 'local',
        status: 'skipped',
        message: '既存の .dev.vars を保持します (非対話モード)',
      }
    }
  }

  if (config.dryRun) {
    console.log(`  作成予定: ${DEV_VARS_PATH}`)
    return {
      step: 'local',
      status: 'completed',
      message: 'dry run: .dev.vars を作成しませんでした',
    }
  }

  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(fullPath, DEFAULT_CONTENT)
  console.log(`  作成完了: ${DEV_VARS_PATH}`)
  console.log('    PREVIEW_MODE=disabled')

  return {
    step: 'local',
    status: 'completed',
    message: '.dev.vars を作成しました',
  }
}
