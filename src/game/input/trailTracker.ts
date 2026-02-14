import type { Vec2 } from '../types'

export type TrailPoint = Vec2 & {
  tMs: number
}

export type TrailSnapshot = {
  pointerId: number
  points: TrailPoint[]
  smoothedPoints: TrailPoint[]
  velocityPxPerS: number
  isSliceActive: boolean
}

export type TrailTrackerConfig = {
  maxPoints: number
  maxAgeMs: number
  sliceVelocityThresholdPxPerS: number
  smoothingAlpha: number
}

const DEFAULT_CONFIG: TrailTrackerConfig = {
  maxPoints: 16,
  maxAgeMs: 150,
  sliceVelocityThresholdPxPerS: 850,
  smoothingAlpha: 0.35,
}

type MutableTrail = {
  pointerId: number
  points: TrailPoint[]
  smoothedPoints: TrailPoint[]
  velocityPxPerS: number
  isSliceActive: boolean
}

export type TrailTracker = {
  beginTrail: (pointerId: number, point: TrailPoint) => void
  appendPoint: (pointerId: number, point: TrailPoint) => void
  endTrail: (pointerId: number, point?: TrailPoint) => void
  hasTrail: (pointerId: number) => boolean
  clear: () => void
  getActiveTrails: () => TrailSnapshot[]
}

function clampAlpha(alpha: number): number {
  return Math.min(1, Math.max(0, alpha))
}

function pruneTrail(points: TrailPoint[], nowMs: number, config: TrailTrackerConfig): void {
  const minTime = nowMs - config.maxAgeMs

  while (points.length > 0 && points[0].tMs < minTime) {
    points.shift()
  }

  if (points.length > config.maxPoints) {
    points.splice(0, points.length - config.maxPoints)
  }
}

function computeVelocityPxPerS(points: TrailPoint[]): number {
  if (points.length < 2) {
    return 0
  }

  const first = points[0]
  const last = points[points.length - 1]
  const dtMs = last.tMs - first.tMs
  if (dtMs <= 0) {
    return 0
  }

  const dx = last.x - first.x
  const dy = last.y - first.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  return (distance / dtMs) * 1000
}

export function createTrailTracker(customConfig: Partial<TrailTrackerConfig> = {}): TrailTracker {
  const config: TrailTrackerConfig = {
    ...DEFAULT_CONFIG,
    ...customConfig,
    smoothingAlpha: clampAlpha(customConfig.smoothingAlpha ?? DEFAULT_CONFIG.smoothingAlpha),
  }
  const trails = new Map<number, MutableTrail>()

  const updateTrailState = (trail: MutableTrail) => {
    trail.velocityPxPerS = computeVelocityPxPerS(trail.points)
    trail.isSliceActive = trail.velocityPxPerS >= config.sliceVelocityThresholdPxPerS
  }

  const beginTrail = (pointerId: number, point: TrailPoint) => {
    trails.set(pointerId, {
      pointerId,
      points: [point],
      smoothedPoints: [point],
      velocityPxPerS: 0,
      isSliceActive: false,
    })
  }

  const appendPoint = (pointerId: number, point: TrailPoint) => {
    const trail = trails.get(pointerId)
    if (!trail) {
      return
    }

    trail.points.push(point)
    pruneTrail(trail.points, point.tMs, config)

    const previousSmoothed = trail.smoothedPoints[trail.smoothedPoints.length - 1]
    const smoothedPoint: TrailPoint = previousSmoothed
      ? {
          x: previousSmoothed.x + (point.x - previousSmoothed.x) * config.smoothingAlpha,
          y: previousSmoothed.y + (point.y - previousSmoothed.y) * config.smoothingAlpha,
          tMs: point.tMs,
        }
      : point

    trail.smoothedPoints.push(smoothedPoint)
    pruneTrail(trail.smoothedPoints, point.tMs, config)
    updateTrailState(trail)
  }

  const endTrail = (pointerId: number, point?: TrailPoint) => {
    if (point) {
      appendPoint(pointerId, point)
    }
    trails.delete(pointerId)
  }

  const getActiveTrails = (): TrailSnapshot[] => {
    const snapshots: TrailSnapshot[] = []
    trails.forEach((trail) => {
      snapshots.push({
        pointerId: trail.pointerId,
        points: trail.points.slice(),
        smoothedPoints: trail.smoothedPoints.slice(),
        velocityPxPerS: trail.velocityPxPerS,
        isSliceActive: trail.isSliceActive,
      })
    })
    return snapshots
  }

  return {
    beginTrail,
    appendPoint,
    endTrail,
    hasTrail: (pointerId) => trails.has(pointerId),
    clear: () => trails.clear(),
    getActiveTrails,
  }
}
