import type { EntityId, GameEntity, GameState } from '../types'
import { OFFSCREEN_MARGIN_PX } from './constants'

function shouldRemoveParticle(entity: GameEntity): boolean {
  return entity.kind === 'particle' && entity.ageMs >= entity.lifetimeMs
}

function shouldRemoveFruitHalf(entity: GameEntity): boolean {
  return entity.kind === 'fruit-half' && entity.ageMs >= entity.lifetimeMs
}

function shouldRemoveDecal(entity: GameEntity): boolean {
  return entity.kind === 'decal' && entity.ageMs >= entity.lifetimeMs
}

function isBelowScreen(entity: GameEntity, worldHeight: number): boolean {
  return entity.position.y - entity.radius > worldHeight + OFFSCREEN_MARGIN_PX
}

function isFarOutsideHorizontalBounds(entity: GameEntity, worldWidth: number): boolean {
  return entity.position.x + entity.radius < -OFFSCREEN_MARGIN_PX || entity.position.x - entity.radius > worldWidth + OFFSCREEN_MARGIN_PX
}

export function stepDespawnSystem(state: GameState): { missedFruits: number } {
  const world = state.world
  const nextEntities: Record<EntityId, GameEntity> = {} as Record<EntityId, GameEntity>
  let missedFruits = 0

  Object.values(world.entities).forEach((entity) => {
    const belowScreen = isBelowScreen(entity, world.bounds.y)
    const outsideHorizontal = isFarOutsideHorizontalBounds(entity, world.bounds.x)
    const expiredParticle = shouldRemoveParticle(entity)
    const expiredFruitHalf = shouldRemoveFruitHalf(entity)
    const expiredDecal = shouldRemoveDecal(entity)

    if (expiredParticle || expiredFruitHalf || expiredDecal) {
      return
    }

    if (belowScreen || outsideHorizontal) {
      if (entity.kind === 'fruit' && belowScreen) {
        world.misses.count += 1
        world.misses.lastMissedFruitId = entity.id
        world.misses.lastMissedAtMs = world.elapsedMs
        missedFruits += 1
      }
      return
    }

    nextEntities[entity.id] = entity
  })

  world.entities = nextEntities
  world.scoreFeedbackEvents = world.scoreFeedbackEvents.filter(
    (event) => world.elapsedMs - event.createdAtMs <= event.lifetimeMs,
  )

  return { missedFruits }
}
