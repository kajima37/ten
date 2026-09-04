import type {
  SetupConfig,
  SetupState,
  StepName,
  StepResult,
} from './setup/types.ts'
import { loadState, markCompleted, isCompleted } from './setup/state.ts'
import { printStepHeader, printStepResult } from './setup/prompt.ts'
import { runToolsStep } from './setup/aa_tools.ts'
import { runKeysStep } from './setup/ab_keys.ts'
import { runSecretsStep } from './setup/ac_secrets.ts'
import { runCloudflareStep } from './setup/ad_cloudflare.ts'
import { runLocalStep } from './setup/ae_local.ts'
import { runGithubStep } from './setup/af_github.ts'
import { runAdminStep } from './setup/ag_admin.ts'
import { runDeployStep } from './setup/ah_deploy.ts'
import { runReleaseStep } from './setup/ai_release.ts'
import { runInstructionsStep } from './setup/aj_instructions.ts'

const STEPS: Array<{
  name: StepName
  number: number
  title: string
  run: (config: SetupConfig, state: SetupState) => Promise<StepResult>
}> = [
  {
    name: 'tools',
    number: 1,
    title: '必要なツールを確認',
    run: runToolsStep,
  },
  {
    name: 'keys',
    number: 2,
    title: 'age 暗号鍵を生成',
    run: runKeysStep,
  },
  {
    name: 'secrets',
    number: 3,
    title: 'シークレットを登録',
    run: runSecretsStep,
  },
  {
    name: 'cloudflare',
    number: 4,
    title: 'Cloudflare リソースを作成',
    run: runCloudflareStep,
  },
  {
    name: 'local',
    number: 5,
    title: 'ローカル Worker 環境を設定',
    run: runLocalStep,
  },
  {
    name: 'github',
    number: 6,
    title: 'GitHub Environments と Pages を設定',
    run: runGithubStep,
  },
  {
    name: 'admin',
    number: 7,
    title: '管理者を登録',
    run: runAdminStep,
  },
  {
    name: 'deploy',
    number: 8,
    title: 'ステージングにデプロイして確認',
    run: runDeployStep,
  },
  {
    name: 'release',
    number: 9,
    title: 'リリース用シークレットを登録',
    run: runReleaseStep,
  },
  {
    name: 'instructions',
    number: 10,
    title: '残りの手動手順を表示',
    run: runInstructionsStep,
  },
]

function parseArgs(argv: string[]): SetupConfig {
  const args = argv.slice(2).filter((a) => a !== 'setup')
  const config: SetupConfig = {
    interactive: true,
    only: undefined,
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--non-interactive') {
      config.interactive = false
    } else if (arg === '--dry-run') {
      config.dryRun = true
    } else if (arg === '--only' && args[i + 1]) {
      config.only = args[i + 1]
      i++
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: pnpm setup [options]')
      console.log()
      console.log('Options:')
      console.log('  --non-interactive   対話入力をスキップ')
      console.log('  --only <step>       指定ステップのみ実行')
      console.log('  --dry-run           実際の変更を行わずに確認')
      console.log('  --help              このヘルプを表示')
      console.log()
      console.log('Steps:')
      for (const step of STEPS) {
        console.log(`  ${step.number}) ${step.name} - ${step.title}`)
      }
      process.exit(0)
    }
  }

  return config
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv)
  let state = loadState()

  console.log()
  console.log('TEN. セットアップ')
  console.log('==================')
  console.log()

  const stepsToRun = config.only
    ? STEPS.filter((s) => s.name === config.only)
    : STEPS

  if (config.only && stepsToRun.length === 0) {
    console.error(`不明なステップ: ${config.only}`)
    console.error(`利用可能なステップ: ${STEPS.map((s) => s.name).join(', ')}`)
    process.exit(1)
  }

  const results: StepResult[] = []

  for (const step of stepsToRun) {
    if (
      !config.only &&
      isCompleted(state, step.name) &&
      step.name !== 'instructions'
    ) {
      printStepHeader(step.number, STEPS.length, step.title)
      printStepResult('skipped', '既に完了済み')
      results.push({
        step: step.name,
        status: 'skipped',
        message: '既に完了済み',
      })
      continue
    }

    printStepHeader(step.number, STEPS.length, step.title)

    try {
      const result = await step.run(config, state)
      results.push(result)
      printStepResult(result.status, result.message)

      if (
        result.status === 'completed' ||
        result.status === 'manual_required'
      ) {
        state = markCompleted(state, result.step)
      }

      if (result.status === 'failed') {
        console.log()
        console.log(
          'セットアップが中断しました。問題を修正して再実行してください:',
        )
        console.log(`  pnpm setup --only ${step.name}`)
        process.exit(1)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      printStepResult('failed', message)
      console.log()
      console.log('エラーによりセットアップが中断しました。')
      console.log(`再実行: pnpm setup --only ${step.name}`)
      process.exit(1)
    }
  }

  console.log()
  console.log('セットアップ完了。')

  const manualSteps = results.filter((r) => r.status === 'manual_required')
  if (manualSteps.length > 0) {
    console.log('上記に表示された手動手順を実行して設定を完了してください。')
  }
}

main()
