import assert from 'node:assert/strict'
import test from 'node:test'

import {
  makeBoard,
  collapseBoard,
  shuffleWithRandom,
  mulberry32,
  findCombination,
} from '@ten/game-core'

import { verifyGame, isValidElimination, SHUFFLE_COST } from '../src/verify.ts'
import type { GameEvent } from '@ten/game-core'

function simulateGame(
  seed: number,
  steps: number,
  shuffleAt?: number,
): {
  score: number
  combo: number
  maxCombo: number
  events: Array<GameEvent>
} {
  const random = mulberry32(seed)
  let board = makeBoard(random)
  let combo = 0
  let maxCombo = 0
  let score = 0
  const events: Array<GameEvent> = []

  for (let index = 0; index < steps; index += 1) {
    if (shuffleAt === index) {
      board = shuffleWithRandom(board, random)
      score = Math.max(0, score - SHUFFLE_COST)
      events.push({ type: 'shuffle' })
      continue
    }
    const path = findCombination(board)
    if (!path) break
    combo += 1
    maxCombo = Math.max(maxCombo, combo)
    score += path.length * 100 + (combo - 1) * 50
    events.push({ type: 'eliminate', cells: path })
    board = collapseBoard(board, path, random)
  }

  return { score, combo, maxCombo, events }
}

test('replay reproduces score and max combo for a simulated game', () => {
  for (const seed of [1, 20260901, 42, 999999]) {
    const simulated = simulateGame(seed, 12)
    const verified = verifyGame(seed, simulated.events)
    assert.equal(verified.score, simulated.score)
    assert.equal(verified.maxCombo, simulated.maxCombo)
    assert.equal(verified.combo, simulated.combo)
  }
})

test('replay stays synchronized after a client uses the server board payload', () => {
  const seed = 20260901
  const random = mulberry32(seed)
  // The API has already generated this board from the shared random stream.
  let board = makeBoard(random)
  const events: Array<GameEvent> = []
  let score = 0
  let combo = 0
  let maxCombo = 0

  for (let index = 0; index < 4; index += 1) {
    const path = findCombination(board)
    if (!path) break
    combo += 1
    maxCombo = Math.max(maxCombo, combo)
    score += path.length * 100 + (combo - 1) * 50
    events.push({ type: 'eliminate', cells: path })
    board = collapseBoard(board, path, random)
  }

  const verified = verifyGame(seed, events)
  assert.deepEqual(verified, { score, combo, maxCombo })
})

test('replay accounts for shuffles and their score cost', () => {
  const seed = 20260901
  const simulated = simulateGame(seed, 10, 3)
  const verified = verifyGame(seed, simulated.events)
  assert.equal(verified.score, simulated.score)
  assert.equal(verified.maxCombo, simulated.maxCombo)
  assert.ok(simulated.events.some((event) => event.type === 'shuffle'))
})

test('replay rejects shuffles before their score cost is earned', () => {
  assert.throws(() => verifyGame(20260101, [{ type: 'shuffle' }]))
})

test('a miss resets the combo before the next elimination', () => {
  const simulated = simulateGame(20260901, 2)
  assert.equal(simulated.events.length, 2)
  const first = simulated.events[0]
  const second = simulated.events[1]
  if (first.type !== 'eliminate' || second.type !== 'eliminate') {
    throw new Error('simulation did not produce two eliminations')
  }

  const events: Array<GameEvent> = [first, { type: 'miss' }, second]
  const verified = verifyGame(20260901, events)
  const firstScore = first.cells.length * 100
  const secondScore = second.cells.length * 100
  assert.equal(verified.score, firstScore + secondScore)
  assert.equal(verified.maxCombo, 1)
  assert.equal(verified.combo, 1)
})

test('empty event list yields zero score', () => {
  const verified = verifyGame(123, [])
  assert.deepEqual(verified, { score: 0, combo: 0, maxCombo: 0 })
})

test('non-adjacent cells are rejected', () => {
  assert.equal(
    isValidElimination(
      [
        1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9,
        1,
      ],
      [0, 2],
    ),
    false,
  )
})

test('cells whose sum is not ten are rejected', () => {
  const board = [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ]
  assert.equal(isValidElimination(board, [0, 1]), false)
})

test('duplicate cells are rejected', () => {
  assert.equal(
    isValidElimination(
      [
        5, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9,
        1,
      ],
      [0, 0],
    ),
    false,
  )
})

test('a valid elimination is accepted', () => {
  const board = [
    5, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1,
  ]
  assert.equal(isValidElimination(board, [0, 1]), true)
})
