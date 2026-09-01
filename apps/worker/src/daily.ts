import { makeBoard, createDailyRandom } from '@ten/game-core'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export function getJstDateKey(date = new Date()): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS)
  return jst.toISOString().slice(0, 10)
}

export function getDailySeed(dateKey: string): number {
  return Number(dateKey.replaceAll('-', ''))
}

export function getDailyBoard(dateKey: string): Array<number> {
  return makeBoard(createDailyRandom(dateKey))
}

export function jstMidnightTtl(date = new Date()): number {
  const jstDate = new Date(date.getTime() + JST_OFFSET_MS)
  const nextUtcMidnight =
    Date.UTC(
      jstDate.getUTCFullYear(),
      jstDate.getUTCMonth(),
      jstDate.getUTCDate() + 1,
      0,
      0,
      0,
    ) - JST_OFFSET_MS
  return Math.max(60, Math.floor((nextUtcMidnight - date.getTime()) / 1000))
}

export function getJstWeekStartDateKey(date = new Date()): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS)
  const day = jst.getUTCDay()
  const offset = day === 0 ? 6 : day - 1
  jst.setUTCDate(jst.getUTCDate() - offset)
  return jst.toISOString().slice(0, 10)
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
