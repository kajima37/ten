import * as fs from 'node:fs'
import * as path from 'node:path'
import type { WranglerConfig } from './types.ts'

export function parseJsonc(content: string): WranglerConfig {
  const stripped = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([\]}])/g, '$1')
  return JSON.parse(stripped) as WranglerConfig
}

export function formatJsonc(obj: unknown, indent = 2): string {
  const raw = JSON.stringify(obj, null, indent)
  return raw.replace(/([\]}])(\s*\n\s*"([^"]+)":)/g, ',$1\n $2')
}

export function readJsonc(relativePath: string): WranglerConfig {
  const content = fs.readFileSync(
    path.join(process.cwd(), relativePath),
    'utf8',
  )
  return parseJsonc(content)
}

export function writeJsonc(relativePath: string, config: WranglerConfig): void {
  const fullPath = path.join(process.cwd(), relativePath)
  fs.writeFileSync(fullPath, formatJsonc(config) + '\n')
}

export function updateJsonc(
  relativePath: string,
  updater: (config: WranglerConfig) => WranglerConfig,
): void {
  writeJsonc(relativePath, updater(readJsonc(relativePath)))
}
