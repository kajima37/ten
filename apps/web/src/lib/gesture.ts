import { GRID_SIZE, isAdjacent } from '@ten/game-core'
import {
  CELL_CENTER_OFFSET,
  CELL_PITCH,
  getCellCenter,
} from './board-geometry.ts'
import type { BoardPoint } from './board-geometry.ts'

const DEEP_COMMIT_RADIUS = 22
const GRACE_DISTANCE_PX = 40
const DIAGONAL_MIN_RATIO = 0.4
const DIAGONAL_MAX_RATIO = 2.5
const SAMPLE_STEP_PX = CELL_PITCH / 4

export type { BoardPoint }

export function cellIndexFromPoint(point: BoardPoint): number {
  const column = Math.min(
    GRID_SIZE - 1,
    Math.max(0, Math.round((point.x - CELL_CENTER_OFFSET) / CELL_PITCH)),
  )
  const row = Math.min(
    GRID_SIZE - 1,
    Math.max(0, Math.round((point.y - CELL_CENTER_OFFSET) / CELL_PITCH)),
  )
  return row * GRID_SIZE + column
}

function neighborFromDelta(
  anchor: number,
  dx: number,
  dy: number,
): number | null {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX === 0 && absY === 0) return null

  const ratio = absY === 0 ? Number.POSITIVE_INFINITY : absX / absY
  const diagonal = ratio >= DIAGONAL_MIN_RATIO && ratio <= DIAGONAL_MAX_RATIO
  const columnStep = diagonal || ratio > DIAGONAL_MAX_RATIO ? Math.sign(dx) : 0
  const rowStep = diagonal || ratio < DIAGONAL_MIN_RATIO ? Math.sign(dy) : 0
  const anchorRow = Math.floor(anchor / GRID_SIZE)
  const anchorColumn = anchor % GRID_SIZE
  const targetRow = anchorRow + rowStep
  const targetColumn = anchorColumn + columnStep

  if (
    targetRow < 0 ||
    targetRow >= GRID_SIZE ||
    targetColumn < 0 ||
    targetColumn >= GRID_SIZE
  ) {
    return null
  }
  return targetRow * GRID_SIZE + targetColumn
}

export function getPredictedNeighbor(anchor: number, point: BoardPoint) {
  const center = getCellCenter(anchor)
  return neighborFromDelta(anchor, point.x - center.x, point.y - center.y)
}

export function isInsideDeepCommitZone(index: number, point: BoardPoint) {
  const center = getCellCenter(index)
  return (
    Math.hypot(point.x - center.x, point.y - center.y) <= DEEP_COMMIT_RADIUS
  )
}

export type SegmentWalkInput = {
  selected: Array<number>
  anchorEntry: BoardPoint
  from: BoardPoint
  to: BoardPoint
}

export type SegmentWalkResult = {
  indices: Array<number>
  selected: Array<number>
  anchorEntry: BoardPoint
}

function samplePoints(from: BoardPoint, to: BoardPoint): Array<BoardPoint> {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  if (distance === 0) return []
  const count = Math.max(1, Math.ceil(distance / SAMPLE_STEP_PX))
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / count
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    }
  })
}

export function resolveSegmentCommits(
  input: SegmentWalkInput,
): SegmentWalkResult {
  const mirror = [...input.selected]
  let anchorEntry = input.anchorEntry
  const indices: Array<number> = []

  for (const point of samplePoints(input.from, input.to)) {
    const anchor = mirror.at(-1)
    if (anchor === undefined) break
    const cell = cellIndexFromPoint(point)

    if (cell === anchor) {
      anchorEntry = point
      continue
    }

    const backtrackTarget = mirror.at(-2)
    if (cell === backtrackTarget) {
      if (isInsideDeepCommitZone(cell, point)) {
        indices.push(cell)
        mirror.pop()
        anchorEntry = point
      }
      continue
    }

    if (mirror.includes(cell) || !isAdjacent(anchor, cell)) continue

    const traveled = Math.hypot(
      point.x - anchorEntry.x,
      point.y - anchorEntry.y,
    )
    if (traveled > GRACE_DISTANCE_PX) {
      indices.push(cell)
      mirror.push(cell)
      anchorEntry = point
      continue
    }

    const predicted = getPredictedNeighbor(anchor, point)
    const actual = neighborFromDelta(
      anchor,
      point.x - anchorEntry.x,
      point.y - anchorEntry.y,
    )
    if (predicted === null || predicted !== actual) continue
    if (predicted === mirror.at(-2)) {
      indices.push(predicted)
      mirror.pop()
    } else if (!mirror.includes(predicted)) {
      indices.push(predicted)
      mirror.push(predicted)
    }
    anchorEntry = point
  }

  return { indices, selected: mirror, anchorEntry }
}
