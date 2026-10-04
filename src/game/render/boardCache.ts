import type { CanvasMetrics } from '../core/canvasStage'
import type { DojoId } from '../ui/cosmetics'

/** One renderer-owned surface, replaced in place on resize/equip/asset changes. */
export function createBoardCache(
  createSurface = () => globalThis.document?.createElement('canvas'),
) {
  let surface: HTMLCanvasElement | undefined
  let surfaceContext: CanvasRenderingContext2D | null = null
  let previous: {
    metrics: CanvasMetrics
    dojo: DojoId
    background: HTMLImageElement | null
  } | null = null

  return {
    draw(
      ctx: CanvasRenderingContext2D,
      metrics: CanvasMetrics,
      dojo: DojoId,
      background: HTMLImageElement | null,
      paint: (target: CanvasRenderingContext2D) => void,
    ) {
      surface ??= createSurface()
      if (!surfaceContext && surface) surfaceContext = surface.getContext('2d')
      if (!surface || !surfaceContext) {
        paint(ctx)
        return
      }
      const old = previous?.metrics
      if (
        !old ||
        old.widthCssPx !== metrics.widthCssPx ||
        old.heightCssPx !== metrics.heightCssPx ||
        old.widthDevicePx !== metrics.widthDevicePx ||
        old.heightDevicePx !== metrics.heightDevicePx ||
        old.dpr !== metrics.dpr ||
        previous?.dojo !== dojo ||
        previous?.background !== background
      ) {
        // Reset backing store and drawing state, retaining only one equipped board.
        surface.width = metrics.widthDevicePx
        surface.height = metrics.heightDevicePx
        surfaceContext.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)
        paint(surfaceContext)
        previous = { metrics: { ...metrics }, dojo, background }
      }
      ctx.clearRect(0, 0, metrics.widthCssPx, metrics.heightCssPx)
      ctx.drawImage(surface, 0, 0, metrics.widthCssPx, metrics.heightCssPx)
    },
  }
}
