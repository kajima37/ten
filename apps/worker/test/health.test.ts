import assert from 'node:assert/strict'
import test from 'node:test'

import worker from '../src/index.ts'

test('health endpoint responds ok', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/api/health'),
  )
  assert.equal(response.status, 200)
  const body: { status: string } = await response.json()
  assert.equal(body.status, 'ok')
})

test('unknown routes return 404', async () => {
  const response = await worker.fetch(new Request('https://example.com/'))
  assert.equal(response.status, 404)
})
