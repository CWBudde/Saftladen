import type { Renderer } from './renderer'
import { drawBoundingCircle, drawFpsOverlay, drawPointerProbe, drawPointerTrails, drawTrailStats } from './debugDraw'

const backgroundImageModules = import.meta.glob('../../assets/background.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>
const preferredBackgroundImageUrl = Object.values(backgroundImageModules)[0] ?? null

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

type WoodTextureCache = {
  width: number
  height: number
  canvas: HTMLCanvasElement
}

function seededNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453123
  return value - Math.floor(value)
}

function createWoodTexture(width: number, height: number): HTMLCanvasElement | null {
  const surface = globalThis.document?.createElement('canvas')
  if (!surface) {
    return null
  }

  surface.width = Math.max(1, Math.floor(width))
  surface.height = Math.max(1, Math.floor(height))
  const ctx = surface.getContext('2d')
  if (!ctx) {
    return null
  }

  const base = ctx.createLinearGradient(0, 0, 0, surface.height)
  base.addColorStop(0, '#6b3f24')
  base.addColorStop(1, '#3f2215')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, surface.width, surface.height)

  let plankX = 0
  let plankIndex = 0
  while (plankX < surface.width) {
    const plankWidth = Math.max(90, Math.min(185, 110 + Math.floor(seededNoise(plankIndex * 3.21) * 75)))
    const endX = Math.min(surface.width, plankX + plankWidth)
    const lightShift = seededNoise(plankIndex * 1.73) * 0.22 - 0.11
    const plankToneTop = `hsl(26 44% ${34 + lightShift * 100}%)`
    const plankToneBottom = `hsl(24 46% ${27 + lightShift * 100}%)`
    const plankGradient = ctx.createLinearGradient(plankX, 0, plankX, surface.height)
    plankGradient.addColorStop(0, plankToneTop)
    plankGradient.addColorStop(1, plankToneBottom)
    ctx.fillStyle = plankGradient
    ctx.fillRect(plankX, 0, endX - plankX, surface.height)

    ctx.fillStyle = 'rgba(20, 10, 8, 0.26)'
    ctx.fillRect(endX - 1.2, 0, 2.4, surface.height)
    ctx.fillStyle = 'rgba(255, 214, 156, 0.08)'
    ctx.fillRect(plankX + 1, 0, 1.6, surface.height)

    const grainLines = Math.floor(surface.height / 12)
    for (let line = 0; line < grainLines; line += 1) {
      const seed = plankIndex * 101 + line * 13.11
      const yBase = (line / grainLines) * surface.height + seededNoise(seed) * 8
      const phase = seededNoise(seed + 4.2) * Math.PI * 2
      const amplitude = 2 + seededNoise(seed + 8.8) * 2.5
      ctx.strokeStyle = `rgba(255, 231, 190, ${0.05 + seededNoise(seed + 2.7) * 0.05})`
      ctx.lineWidth = 0.9
      ctx.beginPath()
      for (let x = plankX; x <= endX; x += 16) {
        const t = (x - plankX) / Math.max(1, endX - plankX)
        const y = yBase + Math.sin(t * Math.PI * 6 + phase) * amplitude
        if (x === plankX) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    const knotCount = seededNoise(plankIndex * 6.3) > 0.55 ? 1 : 0
    for (let knot = 0; knot < knotCount; knot += 1) {
      const knotSeed = plankIndex * 47 + knot * 9
      const knotX = plankX + (endX - plankX) * (0.25 + seededNoise(knotSeed + 0.9) * 0.5)
      const knotY = surface.height * (0.18 + seededNoise(knotSeed + 1.7) * 0.62)
      const knotRadius = 13 + seededNoise(knotSeed + 3.5) * 14
      ctx.fillStyle = 'rgba(26, 13, 9, 0.4)'
      ctx.beginPath()
      ctx.ellipse(knotX, knotY, knotRadius * 1.1, knotRadius, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 220, 162, 0.18)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(knotX, knotY, knotRadius * 0.72, knotRadius * 0.6, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    plankX = endX
    plankIndex += 1
  }

  for (let seam = 0; seam < 7; seam += 1) {
    const seamSeed = seam * 8.123
    const startX = seededNoise(seamSeed + 0.3) * surface.width
    const startY = seededNoise(seamSeed + 1.1) * surface.height
    const angle = (seededNoise(seamSeed + 2.8) - 0.5) * 1.3
    const length = surface.width * (0.45 + seededNoise(seamSeed + 5.2) * 0.4)
    const endX = startX + Math.cos(angle) * length
    const endY = startY + Math.sin(angle) * length

    ctx.strokeStyle = 'rgba(22, 10, 7, 0.22)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255, 223, 166, 0.09)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(startX + 1.2, startY + 1.2)
    ctx.lineTo(endX + 1.2, endY + 1.2)
    ctx.stroke()
  }

  const vignette = ctx.createRadialGradient(
    surface.width * 0.5,
    surface.height * 0.46,
    surface.width * 0.18,
    surface.width * 0.5,
    surface.height * 0.5,
    Math.max(surface.width, surface.height) * 0.72,
  )
  vignette.addColorStop(0, 'rgba(255, 230, 188, 0.08)')
  vignette.addColorStop(1, 'rgba(16, 8, 6, 0.33)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, surface.width, surface.height)

  return surface
}

function drawBackgroundLayer(
  ctx: CanvasRenderingContext2D,
  widthCssPx: number,
  heightCssPx: number,
  cache: WoodTextureCache | null,
  preferredBackgroundImage: HTMLImageElement | null,
  preferredBackgroundReady: boolean,
): WoodTextureCache | null {
  ctx.clearRect(0, 0, widthCssPx, heightCssPx)

  if (preferredBackgroundImage && preferredBackgroundReady) {
    const sourceWidth = preferredBackgroundImage.naturalWidth || preferredBackgroundImage.width
    const sourceHeight = preferredBackgroundImage.naturalHeight || preferredBackgroundImage.height
    const sourceAspect = sourceWidth / Math.max(1, sourceHeight)
    const targetAspect = widthCssPx / Math.max(1, heightCssPx)
    let sx = 0
    let sy = 0
    let sw = sourceWidth
    let sh = sourceHeight

    if (sourceAspect > targetAspect) {
      sw = sourceHeight * targetAspect
      sx = (sourceWidth - sw) * 0.5
    } else {
      sh = sourceWidth / targetAspect
      sy = (sourceHeight - sh) * 0.5
    }

    ctx.drawImage(preferredBackgroundImage, sx, sy, sw, sh, 0, 0, widthCssPx, heightCssPx)
    return cache
  }

  const width = Math.max(1, Math.floor(widthCssPx))
  const height = Math.max(1, Math.floor(heightCssPx))
  let nextCache = cache

  if (!nextCache || nextCache.width !== width || nextCache.height !== height) {
    const woodTexture = createWoodTexture(width, height)
    if (woodTexture) {
      nextCache = {
        width,
        height,
        canvas: woodTexture,
      }
    } else {
      nextCache = null
    }
  }

  if (nextCache) {
    ctx.drawImage(nextCache.canvas, 0, 0, widthCssPx, heightCssPx)
    return nextCache
  }

  const fallback = ctx.createLinearGradient(0, 0, 0, heightCssPx)
  fallback.addColorStop(0, '#5b341f')
  fallback.addColorStop(1, '#341b10')
  ctx.fillStyle = fallback
  ctx.fillRect(0, 0, widthCssPx, heightCssPx)
  return null
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

    const isPenalty = event.amount < 0
    ctx.fillStyle = isPenalty
      ? `rgba(254, 202, 202, ${alpha.toFixed(3)})`
      : `rgba(236, 253, 245, ${alpha.toFixed(3)})`
    ctx.font = "700 16px 'Segoe UI', Tahoma, sans-serif"
    const scoreLabel = event.amount >= 0 ? `+${event.amount}` : `${event.amount}`
    ctx.fillText(scoreLabel, anchor.x, anchor.y - floatOffsetY)

    if (event.combo > 1) {
      ctx.font = "600 11px 'Segoe UI', Tahoma, sans-serif"
      ctx.fillStyle = `rgba(167, 243, 208, ${alpha.toFixed(3)})`
      ctx.fillText(`combo x${event.combo}`, anchor.x, anchor.y - floatOffsetY - 12)
    }
  })
}

function drawScreenFlashLayer(
  ctx: CanvasRenderingContext2D,
  state: Parameters<Renderer['render']>[1],
  widthCssPx: number,
  heightCssPx: number,
): void {
  if (
    state.world.lastBombHitAtMs !== null &&
    state.world.elapsedMs - state.world.lastBombHitAtMs <= 220
  ) {
    const alpha = 1 - (state.world.elapsedMs - state.world.lastBombHitAtMs) / 220
    ctx.fillStyle = `rgba(239, 68, 68, ${Math.max(0, Math.min(0.35, alpha * 0.35)).toFixed(3)})`
    ctx.fillRect(0, 0, widthCssPx, heightCssPx)
  }
}

export function createPlaceholderRenderer(): Renderer {
  let woodTextureCache: WoodTextureCache | null = null
  let preferredBackgroundImage: HTMLImageElement | null = null
  let preferredBackgroundReady = false

  if (preferredBackgroundImageUrl && typeof Image !== 'undefined') {
    preferredBackgroundImage = new Image()
    preferredBackgroundImage.decoding = 'async'
    preferredBackgroundImage.src = preferredBackgroundImageUrl
    preferredBackgroundImage.onload = () => {
      preferredBackgroundReady = true
    }
    preferredBackgroundImage.onerror = () => {
      preferredBackgroundImage = null
      preferredBackgroundReady = false
    }
  }

  return {
    render: (ctx, state, frameInfo, context) => {
      const { widthCssPx, heightCssPx } = context.metrics
      woodTextureCache = drawBackgroundLayer(
        ctx,
        widthCssPx,
        heightCssPx,
        woodTextureCache,
        preferredBackgroundImage,
        preferredBackgroundReady,
      )
      drawDecalLayer(ctx, state, widthCssPx, heightCssPx)
      drawFruitBombPowerLayer(ctx, state, widthCssPx, heightCssPx)
      drawFruitHalfLayer(ctx, state, widthCssPx, heightCssPx)
      drawParticleLayer(ctx, state, widthCssPx, heightCssPx)
      drawPointerTrails(ctx, context)
      drawScoreFeedbackLayer(ctx, state, widthCssPx, heightCssPx)
      drawScreenFlashLayer(ctx, state, widthCssPx, heightCssPx)

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
