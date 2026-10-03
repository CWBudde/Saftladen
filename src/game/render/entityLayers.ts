import { getSpriteScale, type RenderBuckets, type SpriteScale } from './renderHelpers'

export type FruitImageSet = {
  whole: HTMLImageElement | null
  cut: HTMLImageElement | null
  cutLeft: HTMLImageElement | null
  cutRight: HTMLImageElement | null
  wholeReady: boolean
  cutReady: boolean
  cutLeftReady: boolean
  cutRightReady: boolean
}

export type FruitImages = {
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

export function drawDecalLayer(
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

export function drawFruitBombPowerLayer(
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

export function drawFruitHalfLayer(
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

export function drawParticleLayer(
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
