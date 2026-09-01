export type ResultImageLabels = {
  result: string
  best: string
  combo: string
  daily: string
  tagline: string
}

export function createResultImage({
  score,
  best,
  maxCombo,
  daily,
  labels,
}: {
  score: number
  best: number
  maxCombo: number
  daily: boolean
  labels: ResultImageLabels
}) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')

  const styles = getComputedStyle(document.documentElement)
  const background = styles.getPropertyValue('--background').trim() || '#09090a'
  const foreground = styles.getPropertyValue('--foreground').trim() || '#f6f3ed'
  const card = styles.getPropertyValue('--card').trim() || '#121214'
  const accent = styles.getPropertyValue('--accent').trim() || '#f3c75f'
  const muted =
    styles.getPropertyValue('--muted-foreground').trim() || '#9f9c95'

  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  const gradient = context.createRadialGradient(600, 0, 20, 600, 0, 620)
  gradient.addColorStop(0, accent)
  gradient.addColorStop(1, 'transparent')
  context.globalAlpha = 0.16
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.globalAlpha = 1

  context.fillStyle = card
  context.beginPath()
  context.roundRect(90, 75, 1020, 480, 42)
  context.fill()

  context.textAlign = 'center'
  context.fillStyle = foreground
  context.font = '900 64px Arial, sans-serif'
  context.fillText('TEN.', 600, 165)
  context.fillStyle = accent
  context.font = '700 28px Arial, sans-serif'
  context.fillText(daily ? labels.daily : labels.result, 600, 220)
  context.font = '900 132px Arial, sans-serif'
  context.fillText(score.toLocaleString(), 600, 370)

  context.fillStyle = muted
  context.font = '600 26px Arial, sans-serif'
  context.fillText(
    `${labels.best} ${best.toLocaleString()}    ·    ${labels.combo} ×${maxCombo}`,
    600,
    450,
  )
  context.fillStyle = foreground
  context.font = '600 22px Arial, sans-serif'
  context.fillText(labels.tagline, 600, 510)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create image'))
    }, 'image/png')
  })
}
