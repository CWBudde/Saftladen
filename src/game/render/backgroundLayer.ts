import { createWoodTexture } from './woodTexture'

export type WoodTextureCache = {
  width: number
  height: number
  canvas: HTMLCanvasElement
}

export function drawBackgroundLayer(
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
