import { GRID_SIZE } from './game-logic.ts'

export type BoardPoint = { x: number; y: number }

export const CELL_PITCH = 70
export const CELL_PADDING = 8
export const CELL_SIZE = 64
export const CELL_CENTER_OFFSET = CELL_PADDING + CELL_SIZE / 2

export function getCellCenter(index: number): BoardPoint {
  return {
    x: CELL_CENTER_OFFSET + (index % GRID_SIZE) * CELL_PITCH,
    y: CELL_CENTER_OFFSET + Math.floor(index / GRID_SIZE) * CELL_PITCH,
  }
}
