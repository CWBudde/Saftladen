import type { BladeId, DojoId } from '../ui/cosmetics'
import type { Vec2 } from '../types'

const BLADE_COLORS: Record<BladeId, { glow: string; edge: string }> = {
  bamboo: { glow: '#8cdb72', edge: '#f4ffe6' },
  comet: { glow: '#a78bfa', edge: '#d9faff' },
  'dragon-fang': { glow: '#ff7858', edge: '#fff0a6' },
}

/** Shared by equipment previews and live trails. Width/lifetime never affect contact. */
export function drawBladeSegment(
  ctx: CanvasRenderingContext2D,
  blade: BladeId,
  from: Vec2,
  to: Vec2,
  width: number,
  freshness = 1,
): void {
  const colors = BLADE_COLORS[blade]
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.globalAlpha = freshness * 0.24
  ctx.strokeStyle = colors.glow
  ctx.lineWidth = width * 2.5
  ctx.stroke()
  ctx.globalAlpha = freshness * 0.95
  ctx.strokeStyle = colors.edge
  ctx.lineWidth = width
  ctx.stroke()
  ctx.restore()
}

/** Static scenery in normalized coordinates. No animation, random calls or game state. */
export function drawDojoScenery(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dojo: DojoId,
  woodAlreadyDrawn = false,
): void {
  ctx.save()
  if (dojo !== 'great-wave' || !woodAlreadyDrawn) {
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    const colors =
      dojo === 'sunset-harbor'
        ? ['#382530', '#925a49', '#392a33']
        : dojo === 'storm-temple'
          ? ['#171e39', '#394968', '#182c38']
          : ['#6b3f24', '#4c2b1b', '#382317']
    colors.forEach((color, index) => sky.addColorStop(index / 2, color))
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)
  }
  if (dojo !== 'great-wave') {
    // Keep the sun/moon circular in both tall and wide playfields.
    ctx.fillStyle = dojo === 'sunset-harbor' ? '#dca16d' : '#b0c1d5'
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.arc(
      width * 0.79,
      (height * 172) / 600,
      Math.min(width, height) * (dojo === 'sunset-harbor' ? 0.095 : 0.055),
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.scale(width / 1000, height / 600)
  if (dojo === 'great-wave') {
    // Low-contrast wood engraving, confined to the lower edge of the board.
    ctx.strokeStyle = '#759786'
    ctx.globalAlpha = 0.34
    ctx.lineWidth = 3
    for (let row = 0; row < 4; row++) {
      const y = 526 + row * 19
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(220, y - 76, 275, y + 48, 490, y)
      ctx.bezierCurveTo(710, y - 76, 775, y + 48, 1000, y)
      ctx.stroke()
    }
  } else {
    ctx.fillStyle = dojo === 'sunset-harbor' ? '#372d36' : '#263849'
    ctx.beginPath()
    ctx.moveTo(0, 450)
    for (const [x, y] of [
      [130, 388],
      [245, 438],
      [380, 343],
      [560, 426],
      [690, 380],
      [850, 439],
      [1000, 393],
    ])
      ctx.lineTo(x, y)
    ctx.lineTo(1000, 600)
    ctx.lineTo(0, 600)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = dojo === 'sunset-harbor' ? '#27262e' : '#182730'
    if (dojo === 'sunset-harbor') {
      ctx.fillRect(0, 489, 1000, 111)
      // A pier and two moored boat silhouettes.
      ctx.fillRect(60, 470, 380, 12)
      for (const x of [90, 210, 345]) ctx.fillRect(x, 470, 7, 73)
      for (const x of [540, 755]) {
        ctx.beginPath()
        ctx.moveTo(x, 506)
        ctx.lineTo(x + 110, 506)
        ctx.lineTo(x + 85, 524)
        ctx.lineTo(x + 18, 524)
        ctx.closePath()
        ctx.fill()
        ctx.fillRect(x + 54, 455, 3, 51)
      }
    } else {
      ctx.fillRect(0, 548, 1000, 52)
      ctx.fillRect(145, 426, 15, 124)
      ctx.fillRect(330, 426, 15, 124)
      ctx.fillRect(124, 422, 243, 13)
      ctx.beginPath()
      ctx.moveTo(110, 405)
      ctx.lineTo(245, 420)
      ctx.lineTo(380, 405)
      ctx.lineTo(365, 427)
      ctx.lineTo(124, 427)
      ctx.closePath()
      ctx.fill()
    }
    ctx.strokeStyle = dojo === 'sunset-harbor' ? '#956c58' : '#527080'
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 2
    for (let row = 0; row < 4; row++) {
      const y = 541 + row * 15
      ctx.beginPath()
      ctx.moveTo(460, y)
      ctx.lineTo(985, y)
      ctx.stroke()
    }
  }
  ctx.restore()
}
