import type { Vec2 } from '../types'

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by
}

function squaredDistance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function segmentIntersectsCircle(start: Vec2, end: Vec2, center: Vec2, radius: number): boolean {
  const radiusSq = radius * radius

  if (squaredDistance(start, center) <= radiusSq || squaredDistance(end, center) <= radiusSq) {
    return true
  }

  const segmentDx = end.x - start.x
  const segmentDy = end.y - start.y
  const segmentLenSq = segmentDx * segmentDx + segmentDy * segmentDy
  if (segmentLenSq <= 0) {
    return false
  }

  const toCenterDx = center.x - start.x
  const toCenterDy = center.y - start.y
  const projection = dot(toCenterDx, toCenterDy, segmentDx, segmentDy) / segmentLenSq
  const clampedProjection = Math.max(0, Math.min(1, projection))
  const closest = {
    x: start.x + segmentDx * clampedProjection,
    y: start.y + segmentDy * clampedProjection,
  }

  return squaredDistance(closest, center) <= radiusSq
}

/** A point on the blade segment inside the struck fruit, rather than the swipe endpoint. */
export function closestPointOnSegment(start: Vec2, end: Vec2, point: Vec2): Vec2 {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, dot(point.x - start.x, point.y - start.y, dx, dy) / lengthSq)) : 0
  return { x: start.x + dx * t, y: start.y + dy * t }
}

export function segmentMayHitCircleByAabb(start: Vec2, end: Vec2, center: Vec2, radius: number): boolean {
  const minX = Math.min(start.x, end.x) - radius
  const maxX = Math.max(start.x, end.x) + radius
  const minY = Math.min(start.y, end.y) - radius
  const maxY = Math.max(start.y, end.y) + radius

  return center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY
}
