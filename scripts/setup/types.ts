export interface SetupConfig {
  interactive: boolean
  only: string | undefined
  dryRun: boolean
}

export type StepName =
  | 'tools'
  | 'keys'
  | 'secrets'
  | 'cloudflare'
  | 'local'
  | 'github'
  | 'admin'
  | 'deploy'
  | 'release'
  | 'instructions'

export type StepStatus = 'completed' | 'skipped' | 'failed' | 'manual_required'

export interface StepResult {
  step: StepName
  status: StepStatus
  message: string
}

export interface SetupState {
  completedSteps: StepName[]
  cloudflare?: {
    stagingDatabaseId: string
    productionDatabaseId: string
    stagingKVId: string
    productionKVId: string
  }
  keys?: {
    stagingPublicKey: string
    productionPublicKey: string
  }
}

export interface WranglerEnvEntry {
  name: string
  assets?: {
    directory: string
    binding: string
    not_found_handling: string
    run_worker_first: boolean
  }
  vars: Record<string, string>
  d1_databases: Array<{
    binding: string
    database_name: string
    database_id: string
    migrations_dir: string
    remote: boolean
  }>
  kv_namespaces?: Array<{
    binding: string
    id: string
    remote: boolean
  }>
}

export interface WranglerConfig {
  main: string
  compatibility_date: string
  env: Record<string, WranglerEnvEntry>
}
