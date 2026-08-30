import { Application, extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'

extend({ Container, Graphics, Text })

type GameBoardProps = {
  board: Array<number>
  selected: Array<number>
  disabled?: boolean
  onPointerDown: (index: number) => void
  onPointerEnter: (index: number) => void
}

export default function GameBoard({
  board,
  selected,
  disabled = false,
  onPointerDown,
  onPointerEnter,
}: GameBoardProps) {
  return (
    <div className="game-canvas aspect-square w-full overflow-hidden rounded-2xl">
      <Application
        width={360}
        height={360}
        backgroundColor={0x121214}
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
              eventMode={disabled ? 'none' : 'static'}
              cursor={disabled ? 'default' : 'pointer'}
              onPointerDown={() => onPointerDown(index)}
              onPointerOver={() => onPointerEnter(index)}
            >
              <pixiGraphics
                draw={(graphics) => {
                  graphics.clear()
                  graphics.roundRect(0, 0, 64, 64, 12)
                  graphics.fill(highlighted ? 0x332b18 : 0x1b1b1e)
                  graphics.stroke({
                    color: highlighted ? 0xf3c75f : 0x303033,
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
                  fill: highlighted ? '#f3c75f' : '#f6f3ed',
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
