import type { Renderer } from './renderer'
import { drawBoundingCircle, drawFpsOverlay, drawPointerProbe, drawPointerTrails, drawTrailStats } from './debugDraw'

function worldToCanvas(
  xWorld: number,
  yWorld: number,
  worldWidth: number,
  worldHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (xWorld / worldWidth) * canvasWidth,
    y: (yWorld / worldHeight) * canvasHeight,
  }
}

function worldRadiusToCanvas(radiusWorld: number, worldWidth: number, canvasWidth: number): number {
  return (radiusWorld / worldWidth) * canvasWidth
}

function drawBackgroundLayer(ctx: CanvasRenderingContext2D, widthCssPx: number, heightCssPx: number): void {
  ctx.clearRect(0, 0, widthCssPx, heightCssPx)

  const background = ctx.createLinearGradient(0, 0, 0, heightCssPx)
  background.addColorStop(0, '#0f172a')
  background.addColorStop(1, '#111827')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, widthCssPx, heightCssPx)
}

function drawDecalLayer(
  ctx: CanvasRenderingContext2D,
  state: Parameters<Renderer['render']>[1],
  widthCssPx: number,
  heightCssPx: number,
): void {
  const worldWidth = state.world.bounds.x
  const worldHeight = state.world.bounds.y

  Object.values(state.world.entities).forEach((entity) => {
    if (entity.kind !== 'decal') {
      return
    }

    const center = worldToCanvas(entity.position.x, entity.position.y, worldWidth, worldHeight, widthCssPx, heightCssPx)
    const ageMs = Math.max(0, Math.min(entity.lifetimeMs, entity.ageMs))
    const lifeProgress = entity.lifetimeMs > 0 ? ageMs / entity.lifetimeMs : 1
    const alpha = 1 - lifeProgress
    const radiusWorld = entity.radius + (entity.maxRadius - entity.radius) * lifeProgress
    const radius = worldRadiusToCanvas(radiusWorld, worldWidth, widthCssPx)

    ctx.save()
    ctx.translate(center.x, center.y)
    ctx.rotate(entity.rotationRad)
    ctx.fillStyle = `rgba(254, 242, 242, ${(alpha * 0.22).toFixed(3)})`
    ctx.beginPath()
    ctx.ellipse(0, 0, radius, radius * 0.72, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(17, 24, 39, ${(alpha * 0.07).toFixed(3)})`
    ctx.beginPath()
    ctx.ellipse(0, radius * 0.1, radius * 0.8, radius * 0.52, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

function drawFruitBombPowerLayer(
  ctx: CanvasRenderingContext2D,
  state: Parameters<Renderer['render']>[1],
  widthCssPx: number,
  heightCssPx: number,
): void {
  const worldWidth = state.world.bounds.x
  const worldHeight = state.world.bounds.y

  Object.values(state.world.entities).forEach((entity) => {
    if (entity.kind === 'fruit-half' || entity.kind === 'particle' || entity.kind === 'decal') {
      return
    }

    const center = worldToCanvas(entity.position.x, entity.position.y, worldWidth, worldHeight, widthCssPx, heightCssPx)
    const radius = worldRadiusToCanvas(entity.radius, worldWidth, widthCssPx)
    ctx.save()
    ctx.translate(center.x, center.y)
    ctx.rotate(entity.rotationRad)

    if (entity.kind === 'fruit') {
      ctx.fillStyle = entity.color
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(17, 24, 39, 0.4)'
      ctx.lineWidth = 2
      ctx.stroke()
    } else if (entity.kind === 'bomb') {
      ctx.fillStyle = entity.color
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-radius * 0.5, -radius * 0.8)
      ctx.lineTo(radius * 0.5, -radius * 1.2)
      ctx.stroke()
    } else if (entity.kind === 'power-up') {
      ctx.fillStyle = entity.color
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  })
}

function drawFruitHalfLayer(
  ctx: CanvasRenderingContext2D,
  state: Parameters<Renderer['render']>[1],
  widthCssPx: number,
  heightCssPx: number,
): void {
  const worldWidth = state.world.bounds.x
  const worldHeight = state.world.bounds.y

  Object.values(state.world.entities).forEach((entity) => {
    if (entity.kind !== 'fruit-half') {
      return
    }

    const center = worldToCanvas(entity.position.x, entity.position.y, worldWidth, worldHeight, widthCssPx, heightCssPx)
    const radius = worldRadiusToCanvas(entity.radius, worldWidth, widthCssPx)
    const lifeProgress = entity.lifetimeMs > 0 ? Math.max(0, Math.min(1, entity.ageMs / entity.lifetimeMs)) : 1
    const popScale = 1 + (1 - lifeProgress) * 0.08

    ctx.save()
    ctx.translate(center.x, center.y)
    ctx.rotate(entity.rotationRad)
    ctx.scale(popScale, popScale)
    ctx.fillStyle = entity.color
    ctx.beginPath()
    if (entity.half === 'left') {
      ctx.arc(0, 0, radius, Math.PI * 0.5, Math.PI * 1.5)
    } else {
      ctx.arc(0, 0, radius, -Math.PI * 0.5, Math.PI * 0.5)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.3)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  })
}

function drawParticleLayer(
  ctx: CanvasRenderingContext2D,
  state: Parameters<Renderer['render']>[1],
  widthCssPx: number,
  heightCssPx: number,
): void {
  const worldWidth = state.world.bounds.x
  const worldHeight = state.world.bounds.y

  Object.values(state.world.entities).forEach((entity) => {
    if (entity.kind !== 'particle') {
      return
    }

    const center = worldToCanvas(entity.position.x, entity.position.y, worldWidth, worldHeight, widthCssPx, heightCssPx)
    const radius = worldRadiusToCanvas(entity.radius, worldWidth, widthCssPx)
    const alpha = Math.max(0, 1 - entity.ageMs / entity.lifetimeMs)

    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
    ctx.beginPath()
    ctx.arc(center.x, center.y, Math.max(1, radius), 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawScoreFeedbackLayer(
  ctx: CanvasRenderingContext2D,
  state: Parameters<Renderer['render']>[1],
  widthCssPx: number,
  heightCssPx: number,
): void {
  const worldWidth = state.world.bounds.x
  const worldHeight = state.world.bounds.y

  state.world.scoreFeedbackEvents.forEach((event) => {
    const ageMs = state.world.elapsedMs - event.createdAtMs
    const lifeProgress = Math.max(0, Math.min(1, ageMs / event.lifetimeMs))
    const alpha = 1 - lifeProgress
    const floatOffsetY = lifeProgress * 36
    const anchor = worldToCanvas(
      event.position.x,
      event.position.y,
      worldWidth,
      worldHeight,
      widthCssPx,
      heightCssPx,
    )

    // Subtle hit flash around the slice point for immediate feedback.
    ctx.strokeStyle = `rgba(253, 224, 71, ${(alpha * 0.45).toFixed(3)})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(anchor.x, anchor.y, 10 + lifeProgress * 26, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = `rgba(236, 253, 245, ${alpha.toFixed(3)})`
    ctx.font = "700 16px 'Segoe UI', Tahoma, sans-serif"
    ctx.fillText(`+${event.amount}`, anchor.x, anchor.y - floatOffsetY)

    if (event.combo > 1) {
      ctx.font = "600 11px 'Segoe UI', Tahoma, sans-serif"
      ctx.fillStyle = `rgba(167, 243, 208, ${alpha.toFixed(3)})`
      ctx.fillText(`combo x${event.combo}`, anchor.x, anchor.y - floatOffsetY - 12)
    }
  })
}

function drawHudLayer(ctx: CanvasRenderingContext2D, state: Parameters<Renderer['render']>[1], widthCssPx: number, heightCssPx: number): void {
  if (
    state.world.lastBombHitAtMs !== null &&
    state.world.elapsedMs - state.world.lastBombHitAtMs <= 220
  ) {
    const alpha = 1 - (state.world.elapsedMs - state.world.lastBombHitAtMs) / 220
    ctx.fillStyle = `rgba(239, 68, 68, ${Math.max(0, Math.min(0.35, alpha * 0.35)).toFixed(3)})`
    ctx.fillRect(0, 0, widthCssPx, heightCssPx)
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.font = "600 20px 'Segoe UI', Tahoma, sans-serif"
  ctx.fillText('Canvas layer active', 24, 36)

  ctx.fillStyle = 'rgba(229, 231, 235, 0.95)'
  ctx.font = "400 14px 'Segoe UI', Tahoma, sans-serif"
  ctx.fillText('Layered renderer active (procedural placeholder style).', 24, 58)
  ctx.fillText(`Phase: ${state.phase}`, 24, 80)
  ctx.fillText(`Sim tick: ${state.world.tick} | Sim time: ${state.world.elapsedMs.toFixed(0)}ms`, 24, 102)
  ctx.fillText(`Time scale: ${state.settings.timeScale.preset}`, 24, 124)
  ctx.fillText(
    `entities: ${Object.keys(state.world.entities).length} | waves: ${state.world.spawn.wavesSpawned} | misses: ${state.world.misses.count} | score: ${state.score.current}`,
    24,
    146,
  )
  ctx.fillText(`strikes: ${state.strikes.remaining}/${state.strikes.max} | best: ${state.score.best}`, 24, 168)
}

function drawGameOverLayer(ctx: CanvasRenderingContext2D, state: Parameters<Renderer['render']>[1], widthCssPx: number, heightCssPx: number): void {
  if (state.phase !== 'game-over') {
    return
  }

  ctx.fillStyle = 'rgba(17, 24, 39, 0.62)'
  ctx.fillRect(0, 0, widthCssPx, heightCssPx)
  ctx.fillStyle = '#fef2f2'
  ctx.font = "700 36px 'Segoe UI', Tahoma, sans-serif"
  ctx.fillText('Game Over', widthCssPx * 0.38, heightCssPx * 0.44)
  ctx.font = "500 16px 'Segoe UI', Tahoma, sans-serif"
  ctx.fillText(`Score ${state.score.current} | Best ${state.score.best}`, widthCssPx * 0.37, heightCssPx * 0.5)
  ctx.fillText('Press R to restart', widthCssPx * 0.39, heightCssPx * 0.55)
}

export function createPlaceholderRenderer(): Renderer {
  return {
    render: (ctx, state, frameInfo, context) => {
      const { widthCssPx, heightCssPx } = context.metrics
      drawBackgroundLayer(ctx, widthCssPx, heightCssPx)
      drawDecalLayer(ctx, state, widthCssPx, heightCssPx)
      drawFruitBombPowerLayer(ctx, state, widthCssPx, heightCssPx)
      drawFruitHalfLayer(ctx, state, widthCssPx, heightCssPx)
      drawParticleLayer(ctx, state, widthCssPx, heightCssPx)
      drawPointerTrails(ctx, context)
      drawScoreFeedbackLayer(ctx, state, widthCssPx, heightCssPx)
      drawHudLayer(ctx, state, widthCssPx, heightCssPx)
      drawGameOverLayer(ctx, state, widthCssPx, heightCssPx)

      if (context.debug.enabled) {
        drawBoundingCircle(
          ctx,
          { x: widthCssPx * 0.5, y: heightCssPx * 0.5 },
          Math.min(widthCssPx, heightCssPx) * 0.22,
        )
        drawPointerProbe(ctx, context)
        drawTrailStats(ctx, context)
        drawFpsOverlay(ctx, frameInfo, context)
      }
    },
  }
}
