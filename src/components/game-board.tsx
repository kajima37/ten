import { Application, extend, useTick } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { useEffect, useRef } from 'react'
import type { FederatedPointerEvent } from 'pixi.js'
import type { ReactNode } from 'react'
import type { CollapseMotion } from '#/lib/game-logic'
import { getPredictedNeighbor, isInsideDeepCommitZone } from '#/lib/gesture'

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
  const gestureActive = useRef(false)
  const lockedAnchor = useRef<number | null>(null)
  const lockedTarget = useRef<number | null>(null)
  const committedAnchor = useRef<number | null>(null)

  useEffect(() => {
    lockedAnchor.current = null
    lockedTarget.current = null
    committedAnchor.current = null
  }, [selected])

  useEffect(() => {
    const finishGesture = () => {
      gestureActive.current = false
      lockedAnchor.current = null
      lockedTarget.current = null
      committedAnchor.current = null
    }
    window.addEventListener('pointerup', finishGesture)
    window.addEventListener('pointercancel', finishGesture)
    return () => {
      window.removeEventListener('pointerup', finishGesture)
      window.removeEventListener('pointercancel', finishGesture)
    }
  }, [])

  const startPointerGesture = (index: number) => {
    gestureActive.current = true
    lockedAnchor.current = null
    lockedTarget.current = null
    committedAnchor.current = null
    onPointerDown(index)
  }

  const continuePointerGesture = (
    index: number,
    event: FederatedPointerEvent,
  ) => {
    if (!gestureActive.current || disabled) return
    const anchor = selected.at(-1)
    if (anchor === undefined) return
    if (index === anchor) {
      lockedAnchor.current = null
      lockedTarget.current = null
      committedAnchor.current = null
      return
    }
    if (committedAnchor.current === anchor) return

    const point = { x: event.global.x, y: event.global.y }
    if (lockedAnchor.current !== anchor) {
      lockedAnchor.current = anchor
      lockedTarget.current = getPredictedNeighbor(anchor, point)
    }

    if (
      index === lockedTarget.current ||
      isInsideDeepCommitZone(index, point)
    ) {
      committedAnchor.current = anchor
      onPointerEnter(index)
    }
  }

  const palette = {
    classic: {
      canvas: 0x121214,
      cell: 0x1b1b1e,
      selected: 0x332b18,
      accent: 0xf3c75f,
      text: '#f6f3ed',
      border: 0x303033,
    },
    midnight: {
      canvas: 0x0b1020,
      cell: 0x121b31,
      selected: 0x182c50,
      accent: 0x75a7ff,
      text: '#edf4ff',
      border: 0x263a5f,
    },
    cafe: {
      canvas: 0x21170f,
      cell: 0x302116,
      selected: 0x49331f,
      accent: 0xd9a66f,
      text: '#f7ead8',
      border: 0x59422d,
    },
    sakura: {
      canvas: 0x211219,
      cell: 0x321a25,
      selected: 0x4c2435,
      accent: 0xff9fbd,
      text: '#fff0f5',
      border: 0x5c3042,
    },
    zen: {
      canvas: 0x141b17,
      cell: 0x1e2922,
      selected: 0x30422e,
      accent: 0x9ebc86,
      text: '#edf3e9',
      border: 0x3a4b3e,
    },
    neon: {
      canvas: 0x0d0915,
      cell: 0x181022,
      selected: 0x293411,
      accent: 0xc8ff38,
      text: '#f6f2ff',
      border: 0x493261,
    },
  }[theme] ?? {
    canvas: 0x121214,
    cell: 0x1b1b1e,
    selected: 0x332b18,
    accent: 0xf3c75f,
    text: '#f6f3ed',
    border: 0x303033,
  }

  return (
    <div className="game-canvas aspect-square w-full overflow-hidden rounded-2xl">
      <Application
        width={360}
        height={360}
        backgroundColor={palette.canvas}
        antialias
        resolution={1}
      >
        {selected.length > 1 && (
          <pixiGraphics
            draw={(graphics) => {
              graphics.clear()
              const [first, ...rest] = selected
              graphics.moveTo(
                40 + (first % 5) * 70,
                40 + Math.floor(first / 5) * 70,
              )
              rest.forEach((index) => {
                graphics.lineTo(
                  40 + (index % 5) * 70,
                  40 + Math.floor(index / 5) * 70,
                )
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
          const column = index % 5
          const row = Math.floor(index / 5)
          const x = 8 + column * 70
          const y = 8 + row * 70
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
              disabled={disabled}
              onPointerDown={() => startPointerGesture(index)}
              onPointerEnter={(event) => continuePointerGesture(index, event)}
              onPointerMove={(event) => continuePointerGesture(index, event)}
            >
              <pixiGraphics
                draw={(graphics) => {
                  graphics.clear()
                  graphics.roundRect(0, 0, 64, 64, 12)
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
                  fontFamily: 'Arial',
                  fontSize: 28,
                  fontWeight: '700',
                }}
              />
            </AnimatedCell>
          )
        })}
      </Application>
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
  disabled,
  onPointerDown,
  onPointerEnter,
  onPointerMove,
  children,
}: {
  x: number
  y: number
  highlighted: boolean
  removing: boolean
  motion: CollapseMotion
  reducedMotion: boolean
  disabled: boolean
  onPointerDown: () => void
  onPointerEnter: (event: FederatedPointerEvent) => void
  onPointerMove: (event: FederatedPointerEvent) => void
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
      cell.y = y - (1 - eased) * motion.dropRows * 70
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
      y={y - motion.dropRows * 70}
      alpha={motion.isNew ? 0 : 1}
      pivot={highlighted ? 1.1 : 0}
      eventMode={disabled ? 'none' : 'static'}
      cursor={disabled ? 'default' : 'pointer'}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerEnter}
      onPointerMove={onPointerMove}
    >
      {children}
    </pixiContainer>
  )
}
