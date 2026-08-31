import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPredictedNeighbor,
  isInsideDeepCommitZone,
} from '../src/lib/gesture.ts'

test('gesture direction favors a diagonal near a cell corner', () => {
  assert.equal(getPredictedNeighbor(12, { x: 182, y: 178 }), 8)
  assert.equal(getPredictedNeighbor(12, { x: 178, y: 178 }), 6)
})

test('a deliberate cardinal direction remains cardinal', () => {
  assert.equal(getPredictedNeighbor(12, { x: 184, y: 179 }), 13)
  assert.equal(getPredictedNeighbor(12, { x: 179, y: 174 }), 7)
})

test('non-predicted cells only commit within their center zone', () => {
  assert.equal(isInsideDeepCommitZone(7, { x: 180, y: 142 }), false)
  assert.equal(isInsideDeepCommitZone(7, { x: 180, y: 117 }), true)
})
