import { describe, expect, test } from 'bun:test'
import { createBombEntity, createDecalEntity, createFruitEntity, createFruitHalfEntity, createParticleEntity } from '../src/game/model'
import { collectRenderBuckets, createRenderBuckets, getSpriteScale } from '../src/game/render/renderHelpers'
import type { EntityId, GameEntity } from '../src/game/types'

const motion = {
  position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 },
  rotationRad: 0, angularVelocityRadPerS: 0, radius: 20, color: '#ef4444',
}

describe('render layers', () => {
  test('keeps insertion order within each layer and retains every entity once', () => {
    const fruit = createFruitEntity({ ...motion, fruitType: 'apple' })
    const particle = createParticleEntity({ ...motion, lifetimeMs: 500 })
    const bomb = createBombEntity(motion)
    const decal = createDecalEntity({ ...motion, lifetimeMs: 500, maxRadius: 40 })
    const half = createFruitHalfEntity({ ...motion, fruitType: 'apple', half: 'left', sourceFruitId: fruit.id, lifetimeMs: 500 })
    const entities: Record<EntityId, GameEntity> = {}
    for (const entity of [fruit, particle, bomb, decal, half]) entities[entity.id] = entity
    const buckets = createRenderBuckets()
    collectRenderBuckets(entities, buckets)
    expect(buckets.objects).toEqual([fruit, bomb])
    expect(buckets.decals).toEqual([decal])
    expect(buckets.halves).toEqual([half])
    expect(buckets.particles).toEqual([particle])
    expect(new Set([...buckets.objects, ...buckets.decals, ...buckets.halves, ...buckets.particles]).size).toBe(5)
  })

  test('reuses buffers without retaining removed entities or hidden particle spray', () => {
    const particle = createParticleEntity({ ...motion, lifetimeMs: 500 })
    const entities: Record<EntityId, GameEntity> = { [particle.id]: particle }
    const buckets = createRenderBuckets()
    const buffer = buckets.particles
    collectRenderBuckets(entities, buckets)
    expect(buffer).toEqual([particle])
    collectRenderBuckets(entities, buckets, false)
    expect(buffer).toHaveLength(0)
    expect(buckets.particles).toBe(buffer)
    collectRenderBuckets({}, buckets)
    expect(buckets.objects).toHaveLength(0)
    expect(buckets.decals).toHaveLength(0)
    expect(buckets.halves).toHaveLength(0)
  })
})

describe('sprite sizing', () => {
  test.each([[400, 400], [600, 300], [200, 500]])('preserves aspect ratio for a %i × %i sprite', (width, height) => {
    const scale = getSpriteScale(width, height)
    expect(scale.widthPerRadius / scale.heightPerRadius).toBeCloseTo(width / height)
    expect(Math.max(scale.widthPerRadius, scale.heightPerRadius)).toBeCloseTo(2.3)
  })
})
