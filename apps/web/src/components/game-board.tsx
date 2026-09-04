import { Application, extend, useTick } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { GRID_SIZE } from '@ten/game-core'
import type { CollapseMotion } from '@ten/game-core'
import {
  BOARD_SIZE,
  CELL_PADDING,
  CELL_PITCH,
  CELL_SIZE,
  getCellCenter,
} from '#/lib/board-geometry'
import { cellIndexFromPoint, resolveSegmentCommits } from '#/lib/gesture'
import type { BoardPoint } from '#/lib/gesture'
import { APP_FONT_FAMILY } from '#/lib/fonts'
import { getThemePalette } from '#/lib/themes'

extend({ Container, Graphics, Text })

type GameBoardProps = {
  board: Array<number>
  selected: Array<number>
  removing: Array<number>
  revision: number
  motions: Array<CollapseMotion>
  reducedMotion: boolean
  disabled?: boolean
  theme: string
  onPointerDown: (index: number) => void
  onPointerEnter: (index: number) => void
}

type GestureState = {
  pointerId: number
  lastPoint: BoardPoint
  anchorEntry: BoardPoint
  selected: Array<number>
}

export default function GameBoard({
  board,
  selected,
  removing,
  revision,
  motions,
  reducedMotion,
  disabled = false,
  theme,
  onPointerDown,
  onPointerEnter,
}: GameBoardProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<GestureState | null>(null)
  const [fontReady, setFontReady] = useState(false)

  useEffect(() => {
    let active = true
    const loadFont = async () => {
      try {
        await Promise.all([
          document.fonts.load(`600 28px ${APP_FONT_FAMILY}`),
          document.fonts.load(`700 28px ${APP_FONT_FAMILY}`),
          document.fonts.load(`900 28px ${APP_FONT_FAMILY}`),
        ])
      } catch {
        // Continue with the system fallback if the font cannot be loaded.
      } finally {
        if (active) setFontReady(true)
      }
    }
    void loadFont()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const finishGesture = () => {
      gestureRef.current = null
    }
    window.addEventListener('pointerup', finishGesture)
    window.addEventListener('pointercancel', finishGesture)
    return () => {
      window.removeEventListener('pointerup', finishGesture)
      window.removeEventListener('pointercancel', finishGesture)
    }
  }, [])

  const toBoardPoint = (event: ReactPointerEvent): BoardPoint | null => {
    const canvas = canvasHostRef.current?.querySelector('canvas')
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return {
      x: ((event.clientX - rect.left) / rect.width) * BOARD_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * BOARD_SIZE,
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    const gesture = gestureRef.current
    if (gesture && gesture.pointerId !== event.pointerId) return
    const point = toBoardPoint(event)
    if (!point) return
    const index = cellIndexFromPoint(point)
    gestureRef.current = {
      pointerId: event.pointerId,
      lastPoint: point,
      anchorEntry: point,
      selected: [index],
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // The pointer may already be gone; on-screen dragging still works.
    }
    onPointerDown(index)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId || disabled) return
    const point = toBoardPoint(event)
    if (!point) return
    const result = resolveSegmentCommits({
      selected: gesture.selected,
      anchorEntry: gesture.anchorEntry,
      from: gesture.lastPoint,
      to: point,
    })
    gesture.selected = result.selected
    gesture.anchorEntry = result.anchorEntry
    gesture.lastPoint = point
    for (const index of result.indices) onPointerEnter(index)
  }

  const palette = getThemePalette(theme)
  const resolution =
    typeof window === 'undefined'
      ? 1
      : Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)

  return (
    <div
      ref={canvasHostRef}
      className="game-canvas aspect-square w-full overflow-hidden rounded-2xl"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      {fontReady && (
        <Application
          width={BOARD_SIZE}
          height={BOARD_SIZE}
          backgroundColor={palette.canvas}
          antialias
          resolution={resolution}
          autoDensity
        >
          {selected.length > 1 && (
            <pixiGraphics
              draw={(graphics) => {
                graphics.clear()
                const [first, ...rest] = selected
                const start = getCellCenter(first)
                graphics.moveTo(start.x, start.y)
                rest.forEach((index) => {
                  const point = getCellCenter(index)
                  graphics.lineTo(point.x, point.y)
                })
                graphics.stroke({
                  color: palette.accent,
                  width: 6,
                  alpha: 0.55,
                })
              }}
            />
          )}
          {board.map((value, index) => {
            const column = index % GRID_SIZE
            const row = Math.floor(index / GRID_SIZE)
            const x = CELL_PADDING + column * CELL_PITCH
            const y = CELL_PADDING + row * CELL_PITCH
            const highlighted = selected.includes(index)

            return (
              <AnimatedCell
                key={`${revision}-${index}-${value}`}
                x={x}
                y={y}
                highlighted={highlighted}
                removing={removing.includes(index)}
                motion={motions[index] ?? { dropRows: 0, isNew: false }}
                reducedMotion={reducedMotion}
              >
                <pixiGraphics
                  draw={(graphics) => {
                    graphics.clear()
                    graphics.roundRect(0, 0, CELL_SIZE, CELL_SIZE, 12)
                    graphics.fill(highlighted ? palette.selected : palette.cell)
                    graphics.stroke({
                      color: highlighted ? palette.accent : palette.border,
                      width: 2,
                    })
                  }}
                />
                <pixiText
                  text={String(value)}
                  x={32}
                  y={32}
                  anchor={0.5}
                  style={{
                    fill: highlighted
                      ? `#${palette.accent.toString(16).padStart(6, '0')}`
                      : palette.text,
                    fontFamily: APP_FONT_FAMILY,
                    fontSize: 28,
                    fontWeight: '700',
                  }}
                />
              </AnimatedCell>
            )
          })}
        </Application>
      )}
    </div>
  )
}

function AnimatedCell({
  x,
  y,
  highlighted,
  removing,
  motion,
  reducedMotion,
  children,
}: {
  x: number
  y: number
  highlighted: boolean
  removing: boolean
  motion: CollapseMotion
  reducedMotion: boolean
  children: ReactNode
}) {
  const container = useRef<Container>(null)
  const entrance = useRef(motion.dropRows > 0 ? 0 : 1)
  const removal = useRef(0)

  useEffect(() => {
    if (removing) removal.current = 0
  }, [removing])

  useTick((ticker) => {
    const cell = container.current
    if (!cell) return

    if (reducedMotion) {
      cell.y = y
      cell.alpha = removing ? 0 : 1
      cell.scale.set(highlighted ? 1.035 : 1)
      return
    }

    if (motion.dropRows === 0) {
      cell.y = y
      cell.alpha = 1
    } else {
      const duration = 5 + motion.dropRows * 2
      entrance.current = Math.min(
        1,
        entrance.current + ticker.deltaTime / duration,
      )
      const eased = 1 - Math.pow(1 - entrance.current, 3)
      cell.y = y - (1 - eased) * motion.dropRows * CELL_PITCH
      cell.alpha = motion.isNew ? eased : 1
    }

    if (removing) {
      removal.current = Math.min(1, removal.current + ticker.deltaTime / 7)
      cell.alpha = 1 - removal.current
      cell.scale.set(1 - removal.current * 0.28)
    } else {
      cell.scale.set(highlighted ? 1.035 : 1)
    }
  })

  return (
    <pixiContainer
      ref={container}
      x={x}
      y={y - motion.dropRows * CELL_PITCH}
      alpha={motion.isNew ? 0 : 1}
      pivot={highlighted ? 1.1 : 0}
    >
      {children}
    </pixiContainer>
  )
}
