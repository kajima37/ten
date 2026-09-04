import { execaSync } from 'execa'
import type { SetupConfig, StepResult } from './types.ts'

interface ToolCheck {
  name: string
  command: string
  args: string[]
  hint: string
}

const REQUIRED_TOOLS: ToolCheck[] = [
  {
    name: 'node',
    command: 'node',
    args: ['--version'],
    hint: 'direnv allow または mise install を実行してください',
  },
  {
    name: 'pnpm',
    command: 'pnpm',
    args: ['--version'],
    hint: 'direnv allow または mise install を実行してください',
  },
  {
    name: 'age',
    command: 'age',
    args: ['--version'],
    hint: 'direnv allow または mise install を実行してください',
  },
  {
    name: 'sops',
    command: 'sops',
    args: ['--version'],
    hint: 'direnv allow または mise install を実行してください',
  },
  {
    name: 'wrangler',
    command: 'pnpm',
    args: ['--filter', '@ten/worker', 'exec', 'wrangler', '--version'],
    hint: 'pnpm install を先に実行してください',
  },
  {
    name: 'gh',
    command: 'gh',
    args: ['--version'],
    hint: 'https://cli.github.com/ からインストールしてください',
  },
]

function checkTool(tool: ToolCheck): {
  name: string
  version: string
  ok: boolean
} {
  try {
    const { stdout } = execaSync(tool.command, tool.args, { timeout: 10_000 })
    return { name: tool.name, version: stdout.split('\n')[0], ok: true }
  } catch {
    return { name: tool.name, version: '', ok: false }
  }
}

function checkGhAuth(): boolean {
  try {
    execaSync('gh', ['auth', 'status'], { timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

export async function runToolsStep(config: SetupConfig): Promise<StepResult> {
  if (config.dryRun) {
    return {
      step: 'tools',
      status: 'completed',
      message: 'dry run: 必要ツールの確認をスキップ',
    }
  }

  const results = REQUIRED_TOOLS.map(checkTool)
  const allOk = results.every((r) => r.ok)

  for (const r of results) {
    const status = r.ok ? 'ok' : '不足'
    const version = r.version ? ` (${r.version})` : ''
    console.log(`  [${status}] ${r.name}${version}`)
  }

  if (!allOk) {
    const missing = results
      .filter((r) => !r.ok)
      .map((r) => {
        const tool = REQUIRED_TOOLS.find((t) => t.name === r.name)
        return `  - ${r.name}: ${tool?.hint ?? 'インストールが必要です'}`
      })
    console.log()
    console.log('  不足しているツール:')
    for (const line of missing) {
      console.log(line)
    }
    return {
      step: 'tools',
      status: 'failed',
      message: `不足ツール: ${results
        .filter((r) => !r.ok)
        .map((r) => r.name)
        .join(', ')}`,
    }
  }

  if (!checkGhAuth()) {
    console.log()
    console.log('  [!] gh CLI が未認証です。以下のコマンドで認証してください:')
    console.log('      gh auth login')
    return {
      step: 'tools',
      status: 'failed',
      message: 'gh auth login が必要です',
    }
  }
  console.log('  [ok] gh 認証済み')

  return {
    step: 'tools',
    status: 'completed',
    message: 'すべてのツールが利用可能です',
  }
}
