import type { GameEntity, Vec2, WorldState } from '../types'

function resizeCoordinate(value: number, oldExtent: number, nextExtent: number): number {
  // Preserve exterior margins: an upward launch stays below the new bottom,
  // and resizing alone cannot turn an almost-missed fruit into a miss.
  if (value < 0) return value
  if (value > oldExtent) return nextExtent + value - oldExtent
  return value * nextExtent / oldExtent
}

/** Keep normalized flight arcs; gravity stays fixed and flight time scales with sqrt(height). */
export function resizeWorld(world: WorldState, bounds: Vec2): void {
  const oldBounds = world.bounds
  const flightTimeScale = Math.sqrt(bounds.y / oldBounds.y)
  const resizePoint = (position: Vec2) => {
    position.x = resizeCoordinate(position.x, oldBounds.x, bounds.x)
    position.y = resizeCoordinate(position.y, oldBounds.y, bounds.y)
  }
  const resizeEntity = (entity: GameEntity) => {
    if (entity.space !== 'world') return
    resizePoint(entity.position)
    entity.velocity.x *= (bounds.x / oldBounds.x) / flightTimeScale
    entity.velocity.y *= flightTimeScale
    // Radius, rotation and angular velocity retain their world-unit meaning.
  }
  for (const entity of Object.values(world.entities)) resizeEntity(entity)
  for (const entry of world.spawn.pending) resizeEntity(entry.entity)
  for (const event of world.scoreFeedbackEvents) resizePoint(event.position)
  // Slice contacts belong to the old coordinate system and are frame-local.
  world.sliceEvents = []
  world.bounds = { ...bounds }
}
