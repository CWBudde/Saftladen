import type { FrameInfo } from '../core/gameLoop'
import type { RenderContext } from './renderer'
import type { Vec2 } from '../types'

function drawTextLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillText(text, x, y)
}

export function drawFpsOverlay(ctx: CanvasRenderingContext2D, frameInfo: FrameInfo, context: RenderContext): void {
  const fps = frameInfo.deltaMs > 0 ? (1000 / frameInfo.deltaMs).toFixed(1) : '0.0'
  const { diagnostics } = context.debug
  const { dpr, widthCssPx, heightCssPx } = context.metrics

  ctx.fillStyle = '#93c5fd'
  ctx.font = "400 13px 'Segoe UI', Tahoma, sans-serif"
  drawTextLine(ctx, `Debug: ON | fps~${fps} | dpr=${dpr.toFixed(2)}`, 24, heightCssPx - 62)
  drawTextLine(
    ctx,
    `fixedSteps=${diagnostics.lastAdvanceSteps} | accumulator=${diagnostics.accumulatorMs.toFixed(2)}ms`,
    24,
    heightCssPx - 44,
  )
  drawTextLine(ctx, `frame=${frameInfo.frame} | canvas=${widthCssPx}x${heightCssPx}`, 24, heightCssPx - 26)
}

export function drawBoundingCircle(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  color = 'rgba(248, 250, 252, 0.35)',
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.stroke()
}

export function drawPointerTrails(ctx: CanvasRenderingContext2D, context: RenderContext): void {
  context.debug.trails.forEach((trail) => {
    if (trail.canvasPoints.length < 2) {
      return
    }

    ctx.strokeStyle = trail.isSliceActive ? 'rgba(14, 165, 233, 0.9)' : 'rgba(148, 163, 184, 0.75)'
    ctx.lineWidth = trail.isSliceActive ? 3 : 2
    ctx.beginPath()
    trail.canvasPoints.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y)
      } else {
        ctx.lineTo(point.x, point.y)
      }
    })
    ctx.stroke()

    const endpoint = trail.canvasPoints[trail.canvasPoints.length - 1]
    ctx.fillStyle = trail.isSliceActive ? '#22d3ee' : '#cbd5e1'
    ctx.beginPath()
    ctx.arc(endpoint.x, endpoint.y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function drawTrailStats(ctx: CanvasRenderingContext2D, context: RenderContext): void {
  if (context.debug.trails.length === 0) {
    return
  }

  ctx.fillStyle = '#a5f3fc'
  ctx.font = "400 12px 'Segoe UI', Tahoma, sans-serif"

  context.debug.trails.forEach((trail) => {
    const endpoint = trail.canvasPoints[trail.canvasPoints.length - 1]
    if (!endpoint) {
      return
    }

    const status = trail.isSliceActive ? 'slice' : 'idle'
    drawTextLine(
      ctx,
      `id:${trail.pointerId} ${status} ${trail.velocityPxPerS.toFixed(0)}px/s`,
      Math.min(endpoint.x + 8, context.metrics.widthCssPx - 170),
      Math.max(14, endpoint.y - 10),
    )
  })
}

export function drawPointerProbe(ctx: CanvasRenderingContext2D, context: RenderContext): void {
  const pointer = context.debug.lastPointerCanvas
  if (!pointer) {
    return
  }

  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)'
  ctx.beginPath()
  ctx.arc(pointer.x, pointer.y, 4, 0, Math.PI * 2)
  ctx.fill()

  if (!context.debug.lastPointerWorld) {
    return
  }

  const world = context.debug.lastPointerWorld
  ctx.fillStyle = '#fef3c7'
  ctx.font = "400 12px 'Segoe UI', Tahoma, sans-serif"
  drawTextLine(
    ctx,
    `canvas(${pointer.x.toFixed(0)}, ${pointer.y.toFixed(0)}) -> world(${world.x.toFixed(0)}, ${world.y.toFixed(0)})`,
    Math.min(pointer.x + 8, context.metrics.widthCssPx - 260),
    Math.max(18, pointer.y - 8),
  )
}
