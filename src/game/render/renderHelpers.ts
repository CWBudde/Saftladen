import type { BombEntity, DecalEntity, EntityId, FruitEntity, FruitHalfEntity, GameEntity, ParticleEntity, PowerUpEntity } from '../types'

export type RenderBuckets = {
  decals: DecalEntity[]
  objects: (FruitEntity | BombEntity | PowerUpEntity)[]
  halves: FruitHalfEntity[]
  particles: ParticleEntity[]
}

export function createRenderBuckets(): RenderBuckets {
  return { decals: [], objects: [], halves: [], particles: [] }
}

/** Reuse layer buffers, retaining entity insertion order within each layer. */
export function collectRenderBuckets(
  entities: Readonly<Record<EntityId, GameEntity>>,
  buckets: RenderBuckets,
  includeParticles = true,
): void {
  let decalCount = 0
  let objectCount = 0
  let halfCount = 0
  let particleCount = 0
  for (const id in entities) {
    if (!Object.hasOwn(entities, id)) continue
    const entity = entities[id as EntityId]
    switch (entity.kind) {
      case 'decal': buckets.decals[decalCount++] = entity; break
      case 'fruit-half': buckets.halves[halfCount++] = entity; break
      case 'particle': if (includeParticles) buckets.particles[particleCount++] = entity; break
      default: buckets.objects[objectCount++] = entity
    }
  }
  // Replace existing entries before trimming, so stable populations retain
  // their array storage instead of emptying and regrowing all four buffers.
  buckets.decals.length = decalCount
  buckets.objects.length = objectCount
  buckets.halves.length = halfCount
  buckets.particles.length = particleCount
}

export type SpriteScale = { widthPerRadius: number; heightPerRadius: number }

/** Fit every sprite to the same visual diameter without changing aspect ratio. */
export function getSpriteScale(width: number, height: number): SpriteScale {
  const aspect = Math.max(1, width) / Math.max(1, height)
  const diameterScale = 2 * 1.15
  return {
    widthPerRadius: aspect < 1 ? diameterScale * aspect : diameterScale,
    heightPerRadius: aspect > 1 ? diameterScale / aspect : diameterScale,
  }
}
