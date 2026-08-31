import { GRID_SIZE } from './game-logic.ts'

export type BoardPoint = { x: number; y: number }

const CELL_PITCH = 70
const CELL_CENTER_OFFSET = 40
const DEEP_COMMIT_RADIUS = 22
const DIAGONAL_MIN_RATIO = 0.4
const DIAGONAL_MAX_RATIO = 2.5

export function getCellCenter(index: number): BoardPoint {
  return {
    x: CELL_CENTER_OFFSET + (index % GRID_SIZE) * CELL_PITCH,
    y: CELL_CENTER_OFFSET + Math.floor(index / GRID_SIZE) * CELL_PITCH,
  }
}

export function getPredictedNeighbor(anchor: number, point: BoardPoint) {
  const center = getCellCenter(anchor)
  const dx = point.x - center.x
  const dy = point.y - center.y
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

export function isInsideDeepCommitZone(index: number, point: BoardPoint) {
  const center = getCellCenter(index)
  return (
    Math.hypot(point.x - center.x, point.y - center.y) <= DEEP_COMMIT_RADIUS
  )
}
