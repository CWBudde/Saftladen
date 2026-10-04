import type { Vec2 } from '../types'

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by
}

function squaredDistance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/** First blade contact in [0, 1], including a tangent or a start inside the circle. */
export function segmentCircleHitFraction(
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
): number | null {
  if (!Number.isFinite(radius) || radius < 0) return null
  const dx = end.x - start.x
  const dy = end.y - start.y
  const ox = start.x - center.x
  const oy = start.y - center.y
  const c = ox * ox + oy * oy - radius * radius
  if (c <= 0) return 0
  const a = dx * dx + dy * dy
  if (a <= 0) return null
  const b = ox * dx + oy * dy
  const discriminant = b * b - a * c
  if (discriminant < 0) return null
  const t = (-b - Math.sqrt(discriminant)) / a
  return t >= 0 && t <= 1 ? t : null
}

/**
 * Earliest blade contact with the union of fruit circles between its pre-step
 * and post-step centers. This deliberately accepts any pose during that fixed
 * tick, rather than assuming pointer timestamps share the simulation clock.
 */
export function segmentCapsuleHitFraction(
  start: Vec2,
  end: Vec2,
  previousCenter: Vec2,
  center: Vec2,
  radius: number,
): number | null {
  const motionX = center.x - previousCenter.x
  const motionY = center.y - previousCenter.y
  const length = Math.hypot(motionX, motionY)
  if (length === 0) return segmentCircleHitFraction(start, end, center, radius)
  if (!Number.isFinite(radius) || radius < 0) return null

  const ux = motionX / length
  const uy = motionY / length
  const startX = (start.x - previousCenter.x) * ux + (start.y - previousCenter.y) * uy
  const startY = -(start.x - previousCenter.x) * uy + (start.y - previousCenter.y) * ux
  const deltaX = (end.x - start.x) * ux + (end.y - start.y) * uy
  const deltaY = -(end.x - start.x) * uy + (end.y - start.y) * ux
  // The capsule is a strip rectangle capped by the two endpoint circles.
  let enter = 0
  let exit = 1
  if (deltaX === 0) {
    if (startX < 0 || startX > length) enter = Infinity
  } else {
    const first = -startX / deltaX
    const last = (length - startX) / deltaX
    enter = Math.max(enter, Math.min(first, last))
    exit = Math.min(exit, Math.max(first, last))
  }
  if (deltaY === 0) {
    if (startY < -radius || startY > radius) enter = Infinity
  } else {
    const first = (-radius - startY) / deltaY
    const last = (radius - startY) / deltaY
    enter = Math.max(enter, Math.min(first, last))
    exit = Math.min(exit, Math.max(first, last))
  }
  const stripHit = enter <= exit ? enter : null
  const previousHit = segmentCircleHitFraction(start, end, previousCenter, radius)
  const currentHit = segmentCircleHitFraction(start, end, center, radius)
  let earliest = stripHit
  if (previousHit !== null)
    earliest = earliest === null ? previousHit : Math.min(earliest, previousHit)
  if (currentHit !== null)
    earliest = earliest === null ? currentHit : Math.min(earliest, currentHit)
  return earliest
}

export function segmentMayHitSweptCircleByAabb(
  start: Vec2,
  end: Vec2,
  previousCenter: Vec2,
  center: Vec2,
  radius: number,
): boolean {
  return (
    Math.max(start.x, end.x) >= Math.min(previousCenter.x, center.x) - radius &&
    Math.min(start.x, end.x) <= Math.max(previousCenter.x, center.x) + radius &&
    Math.max(start.y, end.y) >= Math.min(previousCenter.y, center.y) - radius &&
    Math.min(start.y, end.y) <= Math.max(previousCenter.y, center.y) + radius
  )
}

export function segmentIntersectsCircle(
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
): boolean {
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
  const t =
    lengthSq > 0
      ? Math.max(0, Math.min(1, dot(point.x - start.x, point.y - start.y, dx, dy) / lengthSq))
      : 0
  return { x: start.x + dx * t, y: start.y + dy * t }
}

export function segmentMayHitCircleByAabb(
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
): boolean {
  const minX = Math.min(start.x, end.x) - radius
  const maxX = Math.max(start.x, end.x) + radius
  const minY = Math.min(start.y, end.y) - radius
  const maxY = Math.max(start.y, end.y) + radius

  return center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY
}
