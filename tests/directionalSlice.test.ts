import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createFruitEntity } from '../src/game/model'
import type { FruitHalfEntity, GameState, ParticleEntity, Vec2 } from '../src/game/types'

function slice(direction: Vec2, rotationRad = 0) {
  const engine = createGameEngine({ mode: 'zen', seed: 5 })
  engine.start()
  const state = engine.getState() as GameState
  state.world.spawn.nextWaveAtMs = Infinity
  const fruit = createFruitEntity({ fruitType: 'orange', color: '#f97316', position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 }, rotationRad, angularVelocityRadPerS: 0, radius: 30 })
  state.world.entities[fruit.id] = fruit
  engine.setInputTrails([{ pointerId: 1, points: [
    { x: 500 - direction.x * 100, y: 300 - direction.y * 100, tMs: 0 },
    { x: 500 + direction.x * 100, y: 300 + direction.y * 100, tMs: 20 },
  ] }])
  engine.stepOnce()
  return {
    halves: Object.values(state.world.entities).filter((entity): entity is FruitHalfEntity => entity.kind === 'fruit-half'),
    particles: Object.values(state.world.entities).filter((entity): entity is ParticleEntity => entity.kind === 'particle'),
  }
}

describe('directional cut effects', () => {
  test.each([
    [{ x: 1, y: 0 }, { x: 0, y: 1 }],
    [{ x: 0, y: 1 }, { x: -1, y: 0 }],
    [{ x: Math.SQRT1_2, y: Math.SQRT1_2 }, { x: -Math.SQRT1_2, y: Math.SQRT1_2 }],
  ] as const)('fragments separate along the slash normal for %j', (direction, normal) => {
    const { halves, particles } = slice(direction)
    expect(halves).toHaveLength(2)
    const left = halves.find((half) => half.half === 'left')!
    const right = halves.find((half) => half.half === 'right')!
    const dx = right.velocity.x - left.velocity.x
    const dy = right.velocity.y - left.velocity.y
    expect(dx * normal.x + dy * normal.y).toBeGreaterThan(200)
    expect(dx * direction.x + dy * direction.y).toBeCloseTo(0, 6)
    expect(left.position).toEqual(right.position)
    expect(particles.every((particle) => particle.color === '#f97316')).toBe(true)
  })

  test('cut normal is stored relative to fruit rotation, so the clipping plane follows fragment spin', () => {
    const rotation = 0.7
    const { halves } = slice({ x: 0, y: 1 }, rotation)
    expect(halves[0].cutAngleRad).toBeCloseTo(Math.PI - rotation, 6)
    expect(halves[1].cutAngleRad).toBe(halves[0].cutAngleRad)
  })

  test('horizontal swipe sprays juice across both sides of the horizontal cut', () => {
    const { particles } = slice({ x: 1, y: 0 })
    expect(particles.some((particle) => particle.velocity.y < -100)).toBe(true)
    expect(particles.some((particle) => particle.velocity.y > 100)).toBe(true)
  })
})
