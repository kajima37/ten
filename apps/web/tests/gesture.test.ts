import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import {
  cellIndexFromPoint,
  getPredictedNeighbor,
  isInsideDeepCommitZone,
  resolveSegmentCommits,
} from '#/lib/gesture'

describe('gesture detection', () => {
  it('favors a diagonal near a cell corner', () => {
    assert.equal(getPredictedNeighbor(12, { x: 182, y: 178 }), 8)
    assert.equal(getPredictedNeighbor(12, { x: 178, y: 178 }), 6)
  })

  it('keeps a deliberate cardinal direction cardinal', () => {
    assert.equal(getPredictedNeighbor(12, { x: 184, y: 179 }), 13)
    assert.equal(getPredictedNeighbor(12, { x: 179, y: 174 }), 7)
  })

  it('only pops inside the previous cell center zone', () => {
    assert.equal(isInsideDeepCommitZone(7, { x: 180, y: 142 }), false)
    assert.equal(isInsideDeepCommitZone(7, { x: 180, y: 117 }), true)
  })

  it('maps points to the nearest cell and clamps to the board', () => {
    assert.equal(cellIndexFromPoint({ x: 40, y: 40 }), 0)
    assert.equal(cellIndexFromPoint({ x: 180, y: 180 }), 12)
    assert.equal(cellIndexFromPoint({ x: 142, y: 78 }), 6)
    assert.equal(cellIndexFromPoint({ x: -30, y: -30 }), 0)
    assert.equal(cellIndexFromPoint({ x: 500, y: 500 }), 24)
  })

  it('commits every crossed cell on a fast straight swipe', () => {
    const result = resolveSegmentCommits({
      selected: [12],
      anchorEntry: { x: 180, y: 180 },
      from: { x: 180, y: 180 },
      to: { x: 330, y: 180 },
    })
    assert.deepEqual(result.indices, [13, 14])
    assert.deepEqual(result.selected, [12, 13, 14])
  })

  it('commits only diagonal cells on a fast diagonal swipe', () => {
    const result = resolveSegmentCommits({
      selected: [12],
      anchorEntry: { x: 180, y: 180 },
      from: { x: 180, y: 180 },
      to: { x: 322, y: 38 },
    })
    assert.deepEqual(result.indices, [8, 4])
    assert.deepEqual(result.selected, [12, 8, 4])
  })

  it('holds a mismatched direction during grace and commits after it', () => {
    const result = resolveSegmentCommits({
      selected: [12],
      anchorEntry: { x: 210, y: 180 },
      from: { x: 210, y: 180 },
      to: { x: 212, y: 110 },
    })
    assert.deepEqual(result.indices, [7])
    assert.deepEqual(result.selected, [12, 7])
  })

  it('pops the previous cell when the gesture returns through its center', () => {
    const result = resolveSegmentCommits({
      selected: [12, 7],
      anchorEntry: { x: 180, y: 110 },
      from: { x: 180, y: 110 },
      to: { x: 180, y: 176 },
    })
    assert.deepEqual(result.indices, [12])
    assert.deepEqual(result.selected, [12])
  })

  it('does not pop near the previous cell edge', () => {
    const result = resolveSegmentCommits({
      selected: [12, 7],
      anchorEntry: { x: 180, y: 110 },
      from: { x: 180, y: 110 },
      to: { x: 180, y: 155 },
    })
    assert.deepEqual(result.indices, [])
    assert.deepEqual(result.selected, [12, 7])
  })

  it('ignores a segment that does not move', () => {
    const result = resolveSegmentCommits({
      selected: [12],
      anchorEntry: { x: 180, y: 180 },
      from: { x: 180, y: 180 },
      to: { x: 180, y: 180 },
    })
    assert.deepEqual(result.indices, [])
    assert.deepEqual(result.selected, [12])
  })
})
