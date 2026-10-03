import type { SliceTrail, Vec2 } from '../types'

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
  // A gentle moving drag should cut; only stationary/near-stationary input is ignored.
  sliceVelocityThresholdPxPerS: 120,
  smoothingAlpha: 0.35,
}

type MutableTrail = {
  strokeId: number
  pointerId: number
  points: TrailPoint[]
  smoothedPoints: TrailPoint[]
  velocityPxPerS: number
  isSliceActive: boolean
  active: boolean
  lastPoint: TrailPoint
}

export type TrailTracker = {
  beginTrail: (pointerId: number, point: TrailPoint) => void
  appendPoint: (pointerId: number, point: TrailPoint) => void
  endTrail: (pointerId: number, point?: TrailPoint) => void
  cancelTrail: (pointerId: number) => void
  hasTrail: (pointerId: number) => boolean
  clear: () => void
  getActiveTrails: (nowMs?: number) => TrailSnapshot[]
  drainSliceTrails: (nowMs?: number) => SliceTrail[]
  setSliceSensitivity: (sensitivity: number) => void
  setViewportScale: (scale: number) => void
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
  let pendingSegments: SliceTrail[] = []
  let nextStrokeId = 1
  let sensitivity = 1
  let viewportScale = 1
  const velocityThreshold = () => config.sliceVelocityThresholdPxPerS * viewportScale / sensitivity

  const updateTrailState = (trail: MutableTrail) => {
    trail.velocityPxPerS = computeVelocityPxPerS(trail.points)
    trail.isSliceActive = trail.velocityPxPerS >= velocityThreshold()
  }

  const beginTrail = (pointerId: number, point: TrailPoint) => {
    // A reused pointer ID must never carry fruit into the next gesture.
    if (trails.get(pointerId)?.active) endTrail(pointerId)
    trails.set(pointerId, {
      strokeId: nextStrokeId++,
      pointerId,
      points: [{ ...point }],
      smoothedPoints: [{ ...point }],
      velocityPxPerS: 0,
      isSliceActive: false,
      active: true,
      lastPoint: { ...point },
    })
  }

  const appendPoint = (pointerId: number, point: TrailPoint) => {
    const trail = trails.get(pointerId)
    if (!trail?.active) {
      return
    }

    const previous = trail.lastPoint
    const dtMs = point.tMs - previous.tMs
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y)
    if (!Number.isFinite(distance) || !Number.isFinite(point.tMs) || dtMs < 0) {
      return
    }
    // Collision uses each fresh raw movement once. Smoothing is only for drawing.
    if (distance > 0 && (dtMs === 0 || distance * 1000 / dtMs >= velocityThreshold())) {
      pendingSegments.push({ pointerId, strokeId: trail.strokeId, points: [{ ...previous }, { ...point }] })
    }
    trail.lastPoint = { ...point }
    trail.points.push({ ...point })
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
    const trail = trails.get(pointerId)
    if (trail?.active) {
      trail.active = false
      const last = [...pendingSegments].reverse().find((segment) => segment.strokeId === trail.strokeId)
      if (last) last.ended = true
      else pendingSegments.push({ pointerId, strokeId: trail.strokeId, ended: true, points: [] })
    }
  }

  const getActiveTrails = (nowMs = performance.now()): TrailSnapshot[] => {
    const snapshots: TrailSnapshot[] = []
    trails.forEach((trail) => {
      pruneTrail(trail.points, nowMs, config)
      pruneTrail(trail.smoothedPoints, nowMs, config)
      updateTrailState(trail)
      if (trail.points.length === 0) {
        if (!trail.active) trails.delete(trail.pointerId)
        return
      }
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

  const drainSliceTrails = (nowMs = performance.now()): SliceTrail[] => {
    const segments = pendingSegments.flatMap((segment) => {
      if (segment.points[1]?.tMs >= nowMs - config.maxAgeMs) return [segment]
      return segment.ended ? [{ ...segment, points: [] }] : []
    })
    pendingSegments = []
    return segments
  }

  return {
    beginTrail,
    appendPoint,
    endTrail,
    cancelTrail: (pointerId) => {
      trails.delete(pointerId)
      pendingSegments = pendingSegments.filter((segment) => segment.pointerId !== pointerId)
    },
    hasTrail: (pointerId) => trails.get(pointerId)?.active ?? false,
    clear: () => {
      trails.clear()
      pendingSegments = []
    },
    getActiveTrails,
    drainSliceTrails,
    setSliceSensitivity: (value) => {
      sensitivity = Number.isFinite(value) ? Math.min(2, Math.max(0.5, value)) : 1
    },
    setViewportScale: (value) => {
      viewportScale = Number.isFinite(value) && value > 0 ? value : 1
    },
  }
}
