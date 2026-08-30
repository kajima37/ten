import { Application, extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'

extend({ Container, Graphics, Text })

type GameBoardProps = {
  board: Array<number>
  selected: Array<number>
  disabled?: boolean
  theme: string
  onPointerDown: (index: number) => void
  onPointerEnter: (index: number) => void
}

export default function GameBoard({
  board,
  selected,
  disabled = false,
  theme,
  onPointerDown,
  onPointerEnter,
}: GameBoardProps) {
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
        {board.map((value, index) => {
          const column = index % 5
          const row = Math.floor(index / 5)
          const x = 8 + column * 70
          const y = 8 + row * 70
          const highlighted = selected.includes(index)

          return (
            <pixiContainer
              key={`${index}-${value}`}
              x={x}
              y={y}
              scale={highlighted ? 1.035 : 1}
              pivot={highlighted ? 1.1 : 0}
              eventMode={disabled ? 'none' : 'static'}
              cursor={disabled ? 'default' : 'pointer'}
              onPointerDown={() => onPointerDown(index)}
              onPointerOver={() => onPointerEnter(index)}
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
            </pixiContainer>
          )
        })}
      </Application>
    </div>
  )
}
