import type { CanvasMetrics } from '../core/canvasStage'
import type { Vec2 } from '../types'

export function pointerEventToCanvasLocal(event: PointerEvent, canvas: HTMLCanvasElement): Vec2 {
  const rect = canvas.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

export function isPointInsideCanvas(point: Vec2, metrics: CanvasMetrics): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= metrics.widthCssPx && point.y <= metrics.heightCssPx
}

export function mapCanvasPointToWorld(point: Vec2, metrics: CanvasMetrics, worldBounds: Vec2): Vec2 {
  if (metrics.widthCssPx <= 0 || metrics.heightCssPx <= 0) {
    return { x: 0, y: 0 }
  }

  return {
    x: (point.x / metrics.widthCssPx) * worldBounds.x,
    y: (point.y / metrics.heightCssPx) * worldBounds.y,
  }
}
