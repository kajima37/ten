import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collapseBoard,
  createDailyRandom,
  findCombination,
  getNextStreak,
  getCollapseMotions,
  isAdjacent,
  makeBoard,
} from '../src/index.ts'

test('daily boards and refill sequences are reproducible', () => {
  const firstRandom = createDailyRandom('2026-08-31')
  const secondRandom = createDailyRandom('2026-08-31')
  const firstBoard = makeBoard(firstRandom)
  const secondBoard = makeBoard(secondRandom)

  assert.deepEqual(firstBoard, secondBoard)
  assert.deepEqual(
    collapseBoard(firstBoard, [0, 1], firstRandom),
    collapseBoard(secondBoard, [0, 1], secondRandom),
  )
})

test('collapse motions only move cells above removed spaces', () => {
  const motions = getCollapseMotions([11, 21])

  assert.deepEqual(motions[21], { dropRows: 1, isNew: false })
  assert.deepEqual(motions[16], { dropRows: 2, isNew: false })
  assert.deepEqual(motions[11], { dropRows: 2, isNew: false })
  assert.deepEqual(motions[6], { dropRows: 2, isNew: true })
  assert.deepEqual(motions[1], { dropRows: 2, isNew: true })
  assert.deepEqual(motions[0], { dropRows: 0, isNew: false })
})

test('combination search supports paths longer than two cells', () => {
  const board = Array.from({ length: 25 }, () => 9)
  board[0] = 2
  board[1] = 3
  board[2] = 5

  assert.deepEqual(findCombination(board), [0, 1, 2])
})

test('generated boards always have a playable combination', () => {
  const board = makeBoard(() => 0)
  assert.ok(findCombination(board))
})

test('adjacency includes diagonals but excludes distant cells', () => {
  assert.equal(isAdjacent(0, 6), true)
  assert.equal(isAdjacent(0, 2), false)
})

test('streak stays on the same day, increments next day, and resets later', () => {
  assert.equal(getNextStreak(4, '2026-08-30', '2026-08-30'), 4)
  assert.equal(getNextStreak(4, '2026-08-30', '2026-08-31'), 5)
  assert.equal(getNextStreak(4, '2026-08-28', '2026-08-31'), 1)
})
