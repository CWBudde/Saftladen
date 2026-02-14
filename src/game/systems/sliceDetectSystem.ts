import type { BombEntity, FruitEntity, GameState, SliceTrail } from '../types'
import { segmentIntersectsCircle, segmentMayHitCircleByAabb } from './collision'

type SliceCandidate = FruitEntity | BombEntity

function getSliceCandidates(state: GameState): SliceCandidate[] {
  return Object.values(state.world.entities).filter(
    (entity): entity is SliceCandidate =>
      (entity.kind === 'fruit' && !entity.sliced) || entity.kind === 'bomb',
  )
}

export function detectSliceEvents(state: GameState, trails: SliceTrail[]): void {
  const queue = state.world.sliceEvents
  queue.length = 0

  const fruits = getSliceCandidates(state)
  if (fruits.length === 0 || trails.length === 0) {
    return
  }

  const queuedFruitIds = new Set<string>()

  trails.forEach((trail) => {
    if (trail.points.length < 2) {
      return
    }

    for (let pointIndex = 1; pointIndex < trail.points.length; pointIndex += 1) {
      const start = trail.points[pointIndex - 1]
      const end = trail.points[pointIndex]

      for (const fruit of fruits) {
        if (queuedFruitIds.has(fruit.id)) {
          continue
        }

        if (!segmentMayHitCircleByAabb(start, end, fruit.position, fruit.radius)) {
          continue
        }

        if (!segmentIntersectsCircle(start, end, fruit.position, fruit.radius)) {
          continue
        }

        queuedFruitIds.add(fruit.id)
        queue.push({
          entityId: fruit.id,
          pointerId: trail.pointerId,
          atMs: end.tMs,
          hitPosition: {
            x: end.x,
            y: end.y,
          },
        })

        // One fruit can only be scored once. If multiple pointers overlap on the same step,
        // first hit wins deterministically by trail iteration order.
      }
    }
  })
}
