export const GRID_SIZE = 5
export const CELL_COUNT = GRID_SIZE * GRID_SIZE
export const TARGET = 10

export function randomNumber(random = Math.random) {
  return 1 + Math.floor(random() * 5)
}

export function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function createDailyRandom(dateKey: string) {
  return mulberry32(Number(dateKey.replaceAll('-', '')))
}

export function getPreviousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function getNextStreak(
  current: number,
  lastDailyDate: string | null,
  dateKey: string,
) {
  if (lastDailyDate === dateKey) return current
  return lastDailyDate === getPreviousDateKey(dateKey) ? current + 1 : 1
}

export function isAdjacent(first: number, second: number) {
  const firstRow = Math.floor(first / GRID_SIZE)
  const firstColumn = first % GRID_SIZE
  const secondRow = Math.floor(second / GRID_SIZE)
  const secondColumn = second % GRID_SIZE

  return (
    Math.max(
      Math.abs(firstRow - secondRow),
      Math.abs(firstColumn - secondColumn),
    ) === 1
  )
}

export function findCombination(board: Array<number>) {
  const search = (
    index: number,
    path: Array<number>,
    sum: number,
  ): Array<number> | null => {
    const nextPath = [...path, index]
    const nextSum = sum + board[index]
    if (nextSum === TARGET && nextPath.length >= 2) return nextPath
    if (nextSum >= TARGET) return null

    for (let candidate = 0; candidate < board.length; candidate += 1) {
      if (!nextPath.includes(candidate) && isAdjacent(index, candidate)) {
        const result = search(candidate, nextPath, nextSum)
        if (result) return result
      }
    }
    return null
  }

  for (let index = 0; index < board.length; index += 1) {
    const result = search(index, [], 0)
    if (result) return result
  }
  return null
}

export function ensurePlayableBoard(
  board: Array<number>,
  random = Math.random,
) {
  if (findCombination(board)) return board

  const next = [...board]
  const row = Math.floor(random() * GRID_SIZE)
  const column = Math.floor(random() * (GRID_SIZE - 1))
  next[row * GRID_SIZE + column] = 5
  next[row * GRID_SIZE + column + 1] = 5
  return next
}

export function makeBoard(random = Math.random) {
  const next = Array.from({ length: CELL_COUNT }, () => randomNumber(random))
  return ensurePlayableBoard(next, random)
}

export function shuffleWithRandom(board: Array<number>, random = Math.random) {
  const next = [...board]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[next[index], next[target]] = [next[target], next[index]]
  }
  return ensurePlayableBoard(next, random)
}

export function collapseBoard(
  board: Array<number>,
  removed: Array<number>,
  random = Math.random,
) {
  const removedSet = new Set(removed)
  const next = Array<number>(CELL_COUNT)

  for (let column = 0; column < GRID_SIZE; column += 1) {
    const values: Array<number> = []
    for (let row = GRID_SIZE - 1; row >= 0; row -= 1) {
      const index = row * GRID_SIZE + column
      if (!removedSet.has(index)) values.push(board[index])
    }
    while (values.length < GRID_SIZE) values.push(randomNumber(random))
    for (let row = GRID_SIZE - 1; row >= 0; row -= 1) {
      next[row * GRID_SIZE + column] = values[GRID_SIZE - 1 - row]
    }
  }

  return ensurePlayableBoard(next, random)
}

export type CollapseMotion = {
  dropRows: number
  isNew: boolean
}

export function getCollapseMotions(removed: Array<number>) {
  const removedSet = new Set(removed)
  const motions = Array.from<unknown, CollapseMotion>(
    { length: CELL_COUNT },
    () => ({ dropRows: 0, isNew: false }),
  )

  for (let column = 0; column < GRID_SIZE; column += 1) {
    const sourceRows: Array<number> = []
    for (let row = GRID_SIZE - 1; row >= 0; row -= 1) {
      if (!removedSet.has(row * GRID_SIZE + column)) sourceRows.push(row)
    }

    const refillCount = GRID_SIZE - sourceRows.length
    for (
      let destinationRow = GRID_SIZE - 1;
      destinationRow >= 0;
      destinationRow -= 1
    ) {
      const destinationIndex = destinationRow * GRID_SIZE + column
      if (destinationRow < refillCount) {
        motions[destinationIndex] = { dropRows: refillCount, isNew: true }
      } else {
        const sourceRow = sourceRows[GRID_SIZE - 1 - destinationRow]
        motions[destinationIndex] = {
          dropRows: destinationRow - sourceRow,
          isNew: false,
        }
      }
    }
  }

  return motions
}
