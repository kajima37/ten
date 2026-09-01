import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { getPredictedNeighbor, isInsideDeepCommitZone } from '#/lib/gesture'

describe('gesture detection', () => {
  it('favors a diagonal near a cell corner', () => {
    assert.equal(getPredictedNeighbor(12, { x: 182, y: 178 }), 8)
    assert.equal(getPredictedNeighbor(12, { x: 178, y: 178 }), 6)
  })

  it('keeps a deliberate cardinal direction cardinal', () => {
    assert.equal(getPredictedNeighbor(12, { x: 184, y: 179 }), 13)
    assert.equal(getPredictedNeighbor(12, { x: 179, y: 174 }), 7)
  })

  it('only commits non-predicted cells within their center zone', () => {
    assert.equal(isInsideDeepCommitZone(7, { x: 180, y: 142 }), false)
    assert.equal(isInsideDeepCommitZone(7, { x: 180, y: 117 }), true)
  })
})
