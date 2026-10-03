import type { BombEntity, FruitEntity, GameState, PowerUpEntity, SliceEvent, SliceTrail, Vec2 } from '../types'
import { segmentCapsuleHitFraction, segmentMayHitSweptCircleByAabb } from './collision'

type SliceCandidate = FruitEntity | BombEntity | PowerUpEntity

type Contact = {
  event: SliceEvent
  segmentStartMs: number
  segmentIndex: number
  fraction: number
}

function getSliceCandidates(state: GameState): SliceCandidate[] {
  return Object.values(state.world.entities).filter(
    (entity): entity is SliceCandidate =>
      (entity.kind === 'fruit' && !entity.sliced) || entity.kind === 'bomb' || entity.kind === 'power-up',
  )
}

/**
 * Only freshly queued, moving blade segments can cut. The optional swept centers
 * cover one physics tick, so the fruit's last visible pose remains hittable even
 * if physics moved it before input was consumed. A visual trail is never reused.
 */
export function detectSliceEvents(
  state: GameState, trails: SliceTrail[], previousPositions?: ReadonlyMap<string, Vec2>,
): void {
  const queue = state.world.sliceEvents
  queue.length = 0
  const candidates = getSliceCandidates(state)
  if (candidates.length === 0 || trails.length === 0) return
  const contacts: Contact[] = []

  for (const trail of trails) {
    for (let pointIndex = 1; pointIndex < trail.points.length; pointIndex++) {
      const start = trail.points[pointIndex - 1]
      const end = trail.points[pointIndex]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy)
      if (length === 0) continue

      for (const entity of candidates) {
        const previous = previousPositions?.get(entity.id) ?? entity.position
        if (!segmentMayHitSweptCircleByAabb(start, end, previous, entity.position, entity.radius)) continue
        const fraction = segmentCapsuleHitFraction(start, end, previous, entity.position, entity.radius)
        if (fraction === null) continue
        contacts.push({
          event: {
            entityId: entity.id,
            pointerId: trail.pointerId,
            strokeId: trail.strokeId,
            atMs: start.tMs + (end.tMs - start.tMs) * fraction,
            hitPosition: { x: start.x + dx * fraction, y: start.y + dy * fraction },
            direction: { x: dx / length, y: dy / length },
          },
          segmentStartMs: start.tMs,
          segmentIndex: pointIndex,
          fraction,
        })
      }
    }
  }

  // Resolve in physical contact order, never entity-map or pointer-array order.
  // Stable gesture/entity IDs break exact ties, including overlapping bombs.
  contacts.sort((a, b) =>
    a.event.atMs - b.event.atMs ||
    (a.event.strokeId ?? a.event.pointerId) - (b.event.strokeId ?? b.event.pointerId) ||
    a.event.pointerId - b.event.pointerId ||
    a.segmentStartMs - b.segmentStartMs ||
    a.segmentIndex - b.segmentIndex ||
    a.fraction - b.fraction ||
    (a.event.entityId < b.event.entityId ? -1 : a.event.entityId > b.event.entityId ? 1 : 0),
  )
  const queuedIds = new Set<string>()
  for (const { event } of contacts) {
    if (queuedIds.has(event.entityId)) continue
    queuedIds.add(event.entityId)
    queue.push(event)
  }
}
