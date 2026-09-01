import {
  makeBoard,
  collapseBoard,
  shuffleWithRandom,
  mulberry32,
  isAdjacent,
  TARGET,
} from '@ten/game-core'
import type { GameEvent } from '@ten/game-core'

export type { GameEvent }

export const SHUFFLE_COST = 50

export type VerifiedResult = {
  score: number
  combo: number
  maxCombo: number
}

export function isValidElimination(
  board: Array<number>,
  cells: Array<number>,
): boolean {
  if (cells.length < 2) return false

  let sum = 0
  const seen = new Set<number>()
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]
    if (cell < 0 || cell >= board.length || seen.has(cell)) return false
    seen.add(cell)
    sum += board[cell]
    if (index > 0 && !isAdjacent(cells[index - 1], cell)) return false
  }
  return sum === TARGET
}

export function verifyGame(
  seed: number,
  events: Array<GameEvent>,
): VerifiedResult {
  const random = mulberry32(seed)
  let board = makeBoard(random)
  let combo = 0
  let maxCombo = 0
  let score = 0

  for (const event of events) {
    if (event.type === 'shuffle') {
      board = shuffleWithRandom(board, random)
      score = Math.max(0, score - SHUFFLE_COST)
      continue
    }

    if (event.type === 'miss') {
      combo = 0
      continue
    }

    if (!isValidElimination(board, event.cells)) {
      throw new Error('Invalid elimination')
    }
    combo += 1
    maxCombo = Math.max(maxCombo, combo)
    score += event.cells.length * 100 + (combo - 1) * 50
    board = collapseBoard(board, event.cells, random)
  }

  return { score, combo, maxCombo }
}
