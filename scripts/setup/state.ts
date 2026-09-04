import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SetupState, StepName } from './types.ts'

const STATE_FILE = '.setup-state.json'

function getStatePath(): string {
  return path.join(process.cwd(), STATE_FILE)
}

export function loadState(): SetupState {
  const statePath = getStatePath()
  if (!fs.existsSync(statePath)) {
    return { completedSteps: [] }
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as SetupState
  } catch {
    return { completedSteps: [] }
  }
}

export function saveState(state: SetupState): void {
  const statePath = getStatePath()
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n')
}

export function markCompleted(state: SetupState, step: StepName): SetupState {
  const next = { ...state }
  if (!next.completedSteps.includes(step)) {
    next.completedSteps = [...next.completedSteps, step]
  }
  saveState(next)
  return next
}

export function isCompleted(state: SetupState, step: StepName): boolean {
  return state.completedSteps.includes(step)
}
