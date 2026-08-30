import { Application, extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'

extend({ Container, Graphics, Text })

const board = [
  2, 6, 1, 7, 4, 9, 3, 5, 2, 8, 4, 8, 2, 6, 1, 3, 3, 9, 4, 7, 5, 2, 6, 3, 9,
]

function GameBoard() {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-2xl">
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
          const highlighted = [7, 12, 16, 20].includes(index)

          return (
            <pixiContainer key={index} x={x} y={y}>
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

export default GameBoard
