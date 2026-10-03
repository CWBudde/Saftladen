import type { CanvasMetrics } from './canvasStage'
import type { Vec2 } from '../types'

export const WORLD_SHORT_EDGE = 720

export type ViewportTransform = {
  scale: number
  offsetX: number
  offsetY: number
}

/** Fill either orientation while keeping circular hit areas and useful mobile sizes. */
export function getAdaptiveWorldBounds(metrics: Pick<CanvasMetrics, 'widthCssPx' | 'heightCssPx'>): Vec2 {
  const width = Math.max(1, metrics.widthCssPx)
  const height = Math.max(1, metrics.heightCssPx)
  const scale = Math.min(width, height) / WORLD_SHORT_EDGE
  return { x: width / scale, y: height / scale }
}

/** Uniform contain transform; adaptive bounds normally fill the entire canvas. */
export function createViewportTransform(
  metrics: Pick<CanvasMetrics, 'widthCssPx' | 'heightCssPx'>,
  bounds: Vec2,
): ViewportTransform {
  const scale = Math.min(metrics.widthCssPx / bounds.x, metrics.heightCssPx / bounds.y)
  if (!Number.isFinite(scale) || scale <= 0) return { scale: 1, offsetX: 0, offsetY: 0 }
  return {
    scale,
    offsetX: (metrics.widthCssPx - bounds.x * scale) / 2,
    offsetY: (metrics.heightCssPx - bounds.y * scale) / 2,
  }
}

export function canvasPointToWorld(point: Vec2, viewport: ViewportTransform): Vec2 {
  return { x: (point.x - viewport.offsetX) / viewport.scale, y: (point.y - viewport.offsetY) / viewport.scale }
}

export function worldPointToCanvas(point: Vec2, viewport: ViewportTransform): Vec2 {
  return { x: point.x * viewport.scale + viewport.offsetX, y: point.y * viewport.scale + viewport.offsetY }
}
