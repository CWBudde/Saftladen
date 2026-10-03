import { gameAssets, type ImageAssetKey } from '../assets'
import type { CanvasMetrics } from '../core/canvasStage'
import type { FrameInfo } from '../core/gameLoop'
import { createViewportTransform, worldPointToCanvas } from '../core/viewport'
import type { EngineDiagnostics } from '../engine'
import type { GamePresentationEvent, GameState, ScoreFeedbackEvent, Vec2 } from '../types'
import { createImpactFeedback } from './impactFeedback'
import { drawBoundingCircle, drawFpsOverlay, drawPointerProbe, drawSpawnEnvelopes, drawTrailStats } from './debugDraw'
import { collectRenderBuckets, createRenderBuckets, getSpriteScale, type RenderBuckets, type SpriteScale } from './renderHelpers'

export type PointerTrailDebug = {
  pointerId: number
  rawCanvasPoints: Vec2[]
  canvasPoints: (Vec2 & { tMs?: number })[]
  worldPoints: Vec2[]
  velocityPxPerS: number
  isSliceActive: boolean
}

export type RendererDebugData = {
  enabled: boolean
  diagnostics: EngineDiagnostics
  trails: PointerTrailDebug[]
  lastPointerCanvas: Vec2 | null
  lastPointerWorld: Vec2 | null
}

export type RenderContext = {
  metrics: CanvasMetrics
  debug: RendererDebugData
  reducedMotion?: boolean
  presentationEvents?: readonly GamePresentationEvent[]
}

export type Renderer = {
  render: (
    ctx: CanvasRenderingContext2D,
    state: Readonly<GameState>,
    frameInfo: FrameInfo,
    context: RenderContext,
  ) => void
}

type FruitImageSet = {
  whole: HTMLImageElement | null
  cut: HTMLImageElement | null
  cutLeft: HTMLImageElement | null
  cutRight: HTMLImageElement | null
  wholeReady: boolean
  cutReady: boolean
  cutLeftReady: boolean
  cutRightReady: boolean
}

type FruitImages = {
  apple: FruitImageSet
  orange: FruitImageSet
  watermelon: FruitImageSet
  pineapple: FruitImageSet
  banana: FruitImageSet
  starfruit: FruitImageSet
}

const spriteScales = new WeakMap<HTMLImageElement, SpriteScale>()

function drawSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, radius: number): void {
  let scale = spriteScales.get(image)
  if (!scale) {
    scale = getSpriteScale(image.naturalWidth || image.width, image.naturalHeight || image.height)
    spriteScales.set(image, scale)
  }
  const width = radius * scale.widthPerRadius
  const height = radius * scale.heightPerRadius
  ctx.drawImage(image, -width / 2, -height / 2, width, height)
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
  decals: RenderBuckets['decals'],
  scaleX: number,
  scaleY: number,
): void {
  for (const entity of decals) {
    const lifeProgress = entity.lifetimeMs > 0
      ? Math.max(0, Math.min(1, entity.ageMs / entity.lifetimeMs))
      : 1
    const alpha = 1 - lifeProgress
    const radius = (entity.radius + (entity.maxRadius - entity.radius) * lifeProgress) * scaleX

    ctx.save()
    ctx.translate(entity.position.x * scaleX, entity.position.y * scaleY)
    ctx.rotate(entity.rotationRad)
    ctx.globalAlpha = alpha * 0.38
    ctx.fillStyle = entity.color
    ctx.beginPath()
    ctx.ellipse(0, 0, radius, radius * 0.72, 0, 0, Math.PI * 2)
    ctx.fill()
    // Small asymmetric droplets make a splat read as juice, without extra entities.
    for (let i = 0; i < 5; i += 1) {
      const angle = i * 2.4 + entity.rotationRad
      const distance = radius * (0.7 + (i % 3) * 0.24)
      ctx.beginPath()
      ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance * 0.7, radius * 0.15, radius * 0.1, angle, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = alpha * 0.07
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.ellipse(0, radius * 0.1, radius * 0.8, radius * 0.52, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawFruitBombPowerLayer(
  ctx: CanvasRenderingContext2D,
  objects: RenderBuckets['objects'],
  scaleX: number,
  scaleY: number,
  fruitImages: FruitImages,
  bombImage: HTMLImageElement | null,
  bombImageReady: boolean,
  freezeGlyphImage: HTMLImageElement | null,
  freezeGlyphReady: boolean,
): void {
  for (const entity of objects) {
    const radius = entity.radius * scaleX
    const scaledRadius = radius * 1.15
    ctx.save()
    ctx.translate(entity.position.x * scaleX, entity.position.y * scaleY)
    ctx.rotate(entity.rotationRad)

    if (entity.kind === 'fruit') {
      const imageSet = fruitImages[entity.fruitType]
      if (imageSet.whole && imageSet.wholeReady) {
        drawSprite(ctx, imageSet.whole, radius)
      } else {
        ctx.fillStyle = entity.color
        ctx.beginPath()
        ctx.arc(0, 0, scaledRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(17, 24, 39, 0.4)'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    } else if (entity.kind === 'bomb') {
      if (bombImage && bombImageReady) {
        drawSprite(ctx, bombImage, radius)
      } else {
        ctx.fillStyle = entity.color
        ctx.beginPath()
        ctx.arc(0, 0, scaledRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-scaledRadius * 0.5, -scaledRadius * 0.8)
        ctx.lineTo(scaledRadius * 0.5, -scaledRadius * 1.2)
        ctx.stroke()
      }
    } else if (entity.powerUpType === 'freeze' && freezeGlyphImage && freezeGlyphReady) {
      drawSprite(ctx, freezeGlyphImage, radius)
    } else {
      ctx.fillStyle = entity.color
      ctx.beginPath()
      ctx.arc(0, 0, scaledRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(0, 0, scaledRadius * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}

function drawFruitHalfLayer(
  ctx: CanvasRenderingContext2D,
  halves: RenderBuckets['halves'],
  scaleX: number,
  scaleY: number,
  fruitImages: FruitImages,
  reducedMotion: boolean,
): void {
  for (const entity of halves) {
    const radius = entity.radius * scaleX
    const lifeProgress = entity.lifetimeMs > 0 ? Math.max(0, Math.min(1, entity.ageMs / entity.lifetimeMs)) : 1
    const popScale = reducedMotion ? 1 : 1 + (1 - lifeProgress) * 0.08

    ctx.save()
    ctx.translate(entity.position.x * scaleX, entity.position.y * scaleY)
    ctx.rotate(entity.rotationRad)
    ctx.scale(popScale, popScale)
    ctx.globalAlpha = Math.min(1, (1 - lifeProgress) * 3)

    const imageSet = fruitImages[entity.fruitType]
    const directionalImage = entity.half === 'left'
      ? (imageSet.cutLeftReady ? imageSet.cutLeft : null)
      : (imageSet.cutRightReady ? imageSet.cutRight : null)
    if (directionalImage) {
      ctx.rotate(entity.cutAngleRad)
      drawSprite(ctx, directionalImage, radius)
    } else if (imageSet.cut && imageSet.cutReady) {
      // Complementary clipping of full cross-section sprites. The generous
      // local rectangle covers any sprite dimensions without allocating bounds.
      const extent = radius * 4
      ctx.rotate(entity.cutAngleRad)
      ctx.beginPath()
      ctx.rect(entity.half === 'left' ? -extent : 0, -extent, extent, extent * 2)
      ctx.clip()
      ctx.rotate(-entity.cutAngleRad)
      drawSprite(ctx, imageSet.cut, radius)
    } else {
      const scaledRadius = radius * 1.15
      ctx.rotate(entity.cutAngleRad)
      ctx.fillStyle = entity.color
      ctx.beginPath()
      if (entity.half === 'left') {
        ctx.arc(0, 0, scaledRadius, Math.PI * 0.5, Math.PI * 1.5)
      } else {
        ctx.arc(0, 0, scaledRadius, -Math.PI * 0.5, Math.PI * 0.5)
      }
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(17, 24, 39, 0.3)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.restore()
  }
}

function drawParticleLayer(
  ctx: CanvasRenderingContext2D,
  particles: RenderBuckets['particles'],
  scaleX: number,
  scaleY: number,
): void {
  ctx.save()
  for (const entity of particles) {
    const radius = entity.radius * scaleX
    const alpha = Math.max(0, 1 - entity.ageMs / entity.lifetimeMs)
    ctx.globalAlpha = alpha
    ctx.fillStyle = entity.color
    ctx.beginPath()
    const direction = Math.atan2(entity.velocity.y, entity.velocity.x)
    ctx.ellipse(entity.position.x * scaleX, entity.position.y * scaleY, Math.max(1.5, radius * 1.4), Math.max(1, radius * 0.7), direction, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawScoreFeedbackLayer(
  ctx: CanvasRenderingContext2D,
  feedback: readonly ScoreFeedbackEvent[],
  elapsedMs: number,
  scaleX: number,
  scaleY: number,
  reducedMotion: boolean,
): void {
  for (const event of feedback) {
    // Bomb penalties have a separate presentation-clock label, including +0.
    if (event.amount <= 0) continue
    const ageMs = elapsedMs - event.createdAtMs
    const lifeProgress = Math.max(0, Math.min(1, ageMs / event.lifetimeMs))
    const alpha = 1 - lifeProgress
    const x = event.position.x * scaleX
    const y = event.position.y * scaleY - (reducedMotion ? 0 : lifeProgress * 36)
      - ((event.strokeCombo ?? 0) >= 3 ? 42 : 0)

    ctx.save()
    if (!reducedMotion) {
      ctx.globalAlpha = alpha * 0.45
      ctx.strokeStyle = '#fde047'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, event.position.y * scaleY, 10 + lifeProgress * 26, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.globalAlpha = alpha
    ctx.fillStyle = event.amount < 0 ? '#fecaca' : '#ecfdf5'
    ctx.font = (event.strokeCombo ?? 0) >= 3
      ? "800 22px 'Segoe UI', Tahoma, sans-serif"
      : "800 19px 'Segoe UI', Tahoma, sans-serif"
    ctx.textAlign = 'center'
    ctx.strokeStyle = '#1e0f0a'
    ctx.lineWidth = 3.5
    const scoreLabel = event.amount >= 0 ? '+' + event.amount : String(event.amount)
    ctx.strokeText(scoreLabel, x, y)
    ctx.fillText(scoreLabel, x, y)

    if ((event.strokeCombo ?? 0) >= 3 || event.combo > 1) {
      ctx.font = "800 13px 'Segoe UI', Tahoma, sans-serif"
      ctx.fillStyle = '#fde047'
      const label = (event.strokeCombo ?? 0) >= 3
        ? 'STROKE COMBO · ' + event.strokeCombo
        : 'STREAK · ' + event.combo + ' HITS'
      ctx.strokeText(label, x, y - 22)
      ctx.fillText(label, x, y - 22)
    }
    ctx.restore()
  }
}

function drawBladeTrails(ctx: CanvasRenderingContext2D, context: RenderContext, nowMs: number): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // TrailTracker bounds the trail history; cap work here as a second guard.
  for (let trailIndex = 0; trailIndex < Math.min(10, context.debug.trails.length); trailIndex += 1) {
    const trail = context.debug.trails[trailIndex]
    const points = trail.canvasPoints
    const firstIndex = Math.max(1, points.length - 24)
    for (let i = firstIndex; i < points.length; i += 1) {
      const from = points[i - 1]
      const to = points[i]
      const freshness = Math.max(0, 1 - Math.max(0, nowMs - (to.tMs ?? nowMs)) / 150)
      if (freshness <= 0 || (from.x === to.x && from.y === to.y)) continue
      const taper = (i - firstIndex + 1) / Math.max(1, points.length - firstIndex)
      const width = (1.5 + taper * 4.5) * freshness
      ctx.globalAlpha = freshness * 0.24
      ctx.strokeStyle = '#38d8ee'
      ctx.lineWidth = width * 2.5
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      ctx.globalAlpha = freshness * 0.95
      ctx.strokeStyle = '#e6fdff'
      ctx.lineWidth = width
      ctx.stroke()
    }
  }
  ctx.restore()
}

function createFruitImageSet(
  wholeKey: ImageAssetKey, cutKey?: ImageAssetKey,
  leftKey?: ImageAssetKey, rightKey?: ImageAssetKey,
): FruitImageSet {
  const whole = gameAssets.getImage(wholeKey)
  const cut = cutKey ? gameAssets.getImage(cutKey) : null
  const cutLeft = leftKey ? gameAssets.getImage(leftKey) : null
  const cutRight = rightKey ? gameAssets.getImage(rightKey) : null
  return {
    whole, cut, cutLeft, cutRight,
    wholeReady: whole !== null, cutReady: cut !== null,
    cutLeftReady: cutLeft !== null, cutRightReady: cutRight !== null,
  }
}

function readFruitImages(): FruitImages {
  return {
    apple: createFruitImageSet('appleWhole', 'appleCut'),
    orange: createFruitImageSet('orangeWhole', undefined, 'orangeLeft', 'orangeRight'),
    watermelon: createFruitImageSet('watermelonWhole', 'watermelonCut'),
    pineapple: createFruitImageSet('pineappleWhole', undefined, 'pineappleLeft', 'pineappleRight'),
    banana: createFruitImageSet('bananaWhole', 'bananaCut'),
    starfruit: createFruitImageSet('starfruitWhole', undefined, 'starfruitLeft', 'starfruitRight'),
  }
}

export function createRenderer(): Renderer {
  let woodTextureCache: WoodTextureCache | null = null
  const buckets = createRenderBuckets()
  const impacts = createImpactFeedback()
  let observedRunId: string | null = null
  let assetSnapshot = gameAssets.getSnapshot()
  let fruitImages = readFruitImages()

  return {
    render: (ctx, state, frameInfo, context) => {
      const nextAssetSnapshot = gameAssets.getSnapshot()
      if (nextAssetSnapshot !== assetSnapshot) {
        assetSnapshot = nextAssetSnapshot
        fruitImages = readFruitImages()
      }
      const preferredBackgroundImage = gameAssets.getImage('background')
      const preferredBackgroundReady = preferredBackgroundImage !== null
      const bombImage = gameAssets.getImage('bomb')
      const bombImageReady = bombImage !== null
      const freezeGlyphImage = gameAssets.getImage('freeze')
      const freezeGlyphReady = freezeGlyphImage !== null
      const { widthCssPx, heightCssPx } = context.metrics
      const viewport = createViewportTransform(context.metrics, state.world.bounds)
      const scaleX = viewport.scale
      const scaleY = viewport.scale
      const reducedMotion = context.reducedMotion ?? false
      collectRenderBuckets(state.world.entities, buckets, !reducedMotion)
      if (state.run.id !== observedRunId || state.phase === 'idle') impacts.reset()
      observedRunId = state.run.id
      if (state.phase !== 'idle') impacts.consume(context.presentationEvents ?? [], frameInfo.timestampMs, state.world.bounds)
      woodTextureCache = drawBackgroundLayer(
        ctx,
        widthCssPx,
        heightCssPx,
        woodTextureCache,
        preferredBackgroundImage,
        preferredBackgroundReady,
      )
      ctx.save()
      ctx.translate(viewport.offsetX, viewport.offsetY)
      drawDecalLayer(ctx, buckets.decals, scaleX, scaleY)
      drawFruitBombPowerLayer(ctx, buckets.objects, scaleX, scaleY, fruitImages, bombImage, bombImageReady, freezeGlyphImage, freezeGlyphReady)
      drawFruitHalfLayer(ctx, buckets.halves, scaleX, scaleY, fruitImages, reducedMotion)
      if (!reducedMotion) {
        drawParticleLayer(ctx, buckets.particles, scaleX, scaleY)
      }
      drawScoreFeedbackLayer(ctx, state.world.scoreFeedbackEvents, state.world.elapsedMs, scaleX, scaleY, reducedMotion)
      ctx.restore()
      drawBladeTrails(ctx, context, frameInfo.timestampMs)
      impacts.draw(ctx, frameInfo.timestampMs, viewport, state.world.bounds, widthCssPx, heightCssPx, reducedMotion)

      if (context.debug.enabled) {
        drawSpawnEnvelopes(ctx, state, viewport)
        for (const entity of buckets.objects) {
          drawBoundingCircle(ctx, worldPointToCanvas(entity.position, viewport), entity.radius * viewport.scale)
        }
        drawPointerProbe(ctx, context)
        drawTrailStats(ctx, context)
        drawFpsOverlay(ctx, frameInfo, context)
      }
    },
  }
}
