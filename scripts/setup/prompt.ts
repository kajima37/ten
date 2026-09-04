import * as p from '@clack/prompts'

export async function confirm(
  message: string,
  initialValue = false,
): Promise<boolean> {
  const result = await p.confirm({
    message,
    initialValue,
    active: 'yes',
    inactive: 'no',
  })
  if (p.isCancel(result)) {
    p.cancel('キャンセルしました')
    process.exit(1)
  }
  return result
}

export async function input(
  message: string,
  options?: { mask?: boolean; defaultValue?: string },
): Promise<string> {
  const result = options?.mask
    ? await p.password({ message })
    : await p.text({ message, defaultValue: options?.defaultValue })
  if (p.isCancel(result)) {
    p.cancel('キャンセルしました')
    process.exit(1)
  }
  return result
}

export async function select(
  message: string,
  choices: Array<{ label: string; value: string }>,
): Promise<string> {
  const result = await p.select({
    message,
    options: choices.map((c) => ({ label: c.label, value: c.value })),
  })
  if (p.isCancel(result)) {
    p.cancel('キャンセルしました')
    process.exit(1)
  }
  return result
}

export function printBlock(title: string, lines: string[]): void {
  p.note(lines.join('\n'), title)
}

export function printStepHeader(
  stepNumber: number,
  total: number,
  title: string,
): void {
  p.log.step(`[${stepNumber}/${total}] ${title}`)
}

export function printStepResult(
  status: 'completed' | 'skipped' | 'failed' | 'manual_required',
  message: string,
): void {
  const icon =
    status === 'completed'
      ? '完了'
      : status === 'skipped'
        ? 'スキップ'
        : status === 'manual_required'
          ? '手動'
          : '失敗'
  if (status === 'failed') {
    p.log.error(`[${icon}] ${message}`)
  } else {
    p.log.success(`[${icon}] ${message}`)
  }
}
