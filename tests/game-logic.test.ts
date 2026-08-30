import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collapseBoard,
  createDailyRandom,
  findCombination,
  getNextStreak,
  isAdjacent,
  makeBoard,
} from '../src/lib/game-logic.ts'

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
