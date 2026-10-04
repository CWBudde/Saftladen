import type { GameEntity, GameState, Vec2 } from '../types'
import { PARTICLE_GRAVITY_PX_PER_S2, WORLD_GRAVITY_PX_PER_S2 } from './constants'

function getEntityGravity(entity: GameEntity): number {
  if (entity.kind === 'particle') {
    return PARTICLE_GRAVITY_PX_PER_S2
  }

  return WORLD_GRAVITY_PX_PER_S2
}

export function stepPhysicsSystem(
  state: GameState,
  dtMs: number,
  previousPositions?: Map<string, Vec2>,
): void {
  const dtSeconds = dtMs / 1000
  const entities = Object.values(state.world.entities)

  entities.forEach((entity) => {
    if (
      previousPositions &&
      (entity.kind === 'fruit' || entity.kind === 'bomb' || entity.kind === 'power-up')
    ) {
      previousPositions.set(entity.id, { x: entity.position.x, y: entity.position.y })
    }
    entity.position.x += entity.velocity.x * dtSeconds
    entity.position.y += entity.velocity.y * dtSeconds
    entity.velocity.y += getEntityGravity(entity) * dtSeconds
    entity.rotationRad += entity.angularVelocityRadPerS * dtSeconds

    if (entity.kind === 'particle' || entity.kind === 'fruit-half' || entity.kind === 'decal') {
      entity.ageMs += dtMs
    }
  })
}
