import assert from 'node:assert/strict'
import { test } from 'node:test'

import worker from '../src/index.ts'
import type { Env } from '../src/index.ts'
import { parseEnv } from '../src/env.ts'
import type { RuntimeEnv } from '../src/env.ts'
import { readJson } from './helpers.ts'

function validRequiredConfig(): RuntimeEnv {
  return {
    PREVIEW_MODE: 'required',
    AUTH_SECRET: 'auth-secret-value',
    PREVIEW_SESSION_SECRET: 'preview-session-secret-value',
    GITHUB_OAUTH_CLIENT_ID: 'github-client-id',
    GITHUB_OAUTH_CLIENT_SECRET: 'github-client-secret',
  }
}

function validDisabledConfig(): RuntimeEnv {
  return {
    PREVIEW_MODE: 'disabled',
    AUTH_SECRET: 'auth-secret-value',
  }
}

test('valid required preview config parses to typed config', () => {
  const result = parseEnv(validRequiredConfig())
  assert.ok(result.ok)
  assert.equal(result.config.previewMode, 'required')
  assert.equal(result.config.authSecret, 'auth-secret-value')
  assert.equal(
    result.config.preview.sessionSecret,
    'preview-session-secret-value',
  )
  assert.deepEqual(result.config.preview.github, {
    clientId: 'github-client-id',
    clientSecret: 'github-client-secret',
  })
  assert.equal(result.config.preview.google, null)
})

test('valid disabled config parses with no preview settings', () => {
  const result = parseEnv(validDisabledConfig())
  assert.ok(result.ok)
  assert.equal(result.config.previewMode, 'disabled')
  assert.equal(result.config.preview.sessionSecret, null)
  assert.equal(result.config.preview.github, null)
  assert.equal(result.config.preview.google, null)
})

test('missing auth secret is rejected', () => {
  const config: Record<string, unknown> = { ...validDisabledConfig() }
  delete config.AUTH_SECRET
  const result = parseEnv(config as RuntimeEnv)
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((issue) => issue.path === 'AUTH_SECRET'))
})

test('invalid PREVIEW_MODE value is rejected', () => {
  const result = parseEnv({
    ...validRequiredConfig(),
    PREVIEW_MODE: 'true',
  } as unknown as RuntimeEnv)
  assert.equal(result.ok, false)
})

test('required mode without session secret is rejected', () => {
  const result = parseEnv({
    ...validRequiredConfig(),
    PREVIEW_SESSION_SECRET: undefined,
  })
  assert.equal(result.ok, false)
  assert.ok(
    result.issues.some((issue) => issue.path === 'PREVIEW_SESSION_SECRET'),
  )
})

test('required mode without GitHub credentials is rejected', () => {
  const result = parseEnv({
    ...validRequiredConfig(),
    GITHUB_OAUTH_CLIENT_ID: undefined,
    GITHUB_OAUTH_CLIENT_SECRET: undefined,
  })
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((issue) => issue.path === 'GITHUB_OAUTH_CLIENT'))
})

test('Google credentials must be provided together', () => {
  const onlyId = {
    ...validRequiredConfig(),
    GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
  }
  assert.equal(parseEnv(onlyId).ok, false)

  const onlySecret = {
    ...validRequiredConfig(),
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  }
  assert.equal(parseEnv(onlySecret).ok, false)

  const pair = {
    ...validRequiredConfig(),
    GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  }
  const result = parseEnv(pair)
  assert.ok(result.ok)
  assert.deepEqual(result.config.preview.google, {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
  })
})

test('preview bindings without required mode are rejected', () => {
  const result = parseEnv({
    ...validDisabledConfig(),
    PREVIEW_SESSION_SECRET: 'preview-session-secret-value',
  })
  assert.equal(result.ok, false)
})

function fetchEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    DB: {} as unknown as D1Database,
    DAILY_CACHE: {} as KVNamespace,
    AUTH_SECRET: 'auth-secret-value',
    PREVIEW_MODE: 'disabled',
    ...overrides,
  }
}

test('health reports the deployed version', async () => {
  const response = await worker.fetch(
    new Request('https://example.workers.dev/api/health'),
    fetchEnv({ DEPLOY_VERSION: 'sha123' }),
  )
  assert.equal(response.status, 200)
  const body = await readJson<{ status: string; version: string }>(response)
  assert.equal(body.status, 'ok')
  assert.equal(body.version, 'sha123')
})

test('missing auth secret fails closed with 503', async () => {
  const response = await worker.fetch(
    new Request('https://example.workers.dev/api/health'),
    fetchEnv({ AUTH_SECRET: undefined }),
  )
  assert.equal(response.status, 503)
})

test('required preview mode without GitHub credentials fails closed', async () => {
  const response = await worker.fetch(
    new Request('https://example.workers.dev/api/health'),
    fetchEnv({
      PREVIEW_MODE: 'required',
      PREVIEW_SESSION_SECRET: 'preview-session-secret-value',
    }),
  )
  assert.equal(response.status, 503)
})
