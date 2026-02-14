import type { GameEntity, GameState } from '../types'
import { PARTICLE_GRAVITY_PX_PER_S2, WORLD_GRAVITY_PX_PER_S2 } from './constants'

function getEntityGravity(entity: GameEntity): number {
  if (entity.kind === 'particle') {
    return PARTICLE_GRAVITY_PX_PER_S2
  }

  return WORLD_GRAVITY_PX_PER_S2
}

export function stepPhysicsSystem(state: GameState, dtMs: number): void {
  const dtSeconds = dtMs / 1000
  const entities = Object.values(state.world.entities)

  entities.forEach((entity) => {
    entity.position.x += entity.velocity.x * dtSeconds
    entity.position.y += entity.velocity.y * dtSeconds
    entity.velocity.y += getEntityGravity(entity) * dtSeconds
    entity.rotationRad += entity.angularVelocityRadPerS * dtSeconds

    if (entity.kind === 'particle' || entity.kind === 'fruit-half' || entity.kind === 'decal') {
      entity.ageMs += dtMs
    }
  })
}
