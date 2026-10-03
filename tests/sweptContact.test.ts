import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createBombEntity, createFruitEntity } from '../src/game/model'
import { segmentCapsuleHitFraction, segmentCircleHitFraction, segmentMayHitSweptCircleByAabb } from '../src/game/systems/collision'
import { stepPhysicsSystem } from '../src/game/systems/physicsSystem'
import { detectSliceEvents } from '../src/game/systems/sliceDetectSystem'
import type { GameState, SliceTrail, Vec2 } from '../src/game/types'

function setup(mode: 'classic' | 'zen' = 'zen') {
  const engine = createGameEngine({ mode, seed: 42, effectsEnabled: false })
  engine.start()
  const state = engine.getState() as GameState
  state.world.spawn.nextWaveAtMs = Infinity
  return { engine, state }
}

const motion = {
  color: '#f00', velocity: { x: 0, y: 0 }, rotationRad: 0, angularVelocityRadPerS: 0, radius: 10,
}
const fruit = (id: string, x: number, y: number) => createFruitEntity({
  ...motion, id, fruitType: 'apple', position: { x, y },
})
const swipe = (pointerId = 1, y = 100, startMs = 0, endMs = 20): SliceTrail => ({
  pointerId, points: [{ x: 0, y, tMs: startMs }, { x: 400, y, tMs: endMs }],
})

const permutations = <T,>(items: T[]): T[][] => items.length === 0 ? [[]] : items.flatMap((item, index) =>
  permutations(items.filter((_, next) => index !== next)).map((rest) => [item, ...rest]))

describe('first contact geometry', () => {
  test('circle entry, tangency, starting inside, zero length and misses', () => {
    expect(segmentCircleHitFraction({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10)).toBeCloseTo(0.4)
    expect(segmentCircleHitFraction({ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 50, y: 0 }, 10)).toBeCloseTo(0.5)
    expect(segmentCircleHitFraction({ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10)).toBe(0)
    expect(segmentCircleHitFraction({ x: 50, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 0 }, 10)).toBe(0)
    expect(segmentCircleHitFraction({ x: 0, y: 11 }, { x: 100, y: 11 }, { x: 50, y: 0 }, 10)).toBeNull()
    expect(segmentCircleHitFraction({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 50, y: 0 }, 10)).toBeNull()
    expect(segmentCircleHitFraction({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, -1)).toBeNull()
  })

  test('capsule catches previous pose, intermediate motion and current pose', () => {
    const old = { x: 100, y: 100 }
    const current = { x: 100, y: 200 }
    for (const y of [100, 150, 200]) {
      expect(segmentCapsuleHitFraction({ x: 0, y }, { x: 400, y }, old, current, 10)).toBeCloseTo(0.225)
    }
    expect(segmentCapsuleHitFraction({ x: 0, y: 210 }, { x: 400, y: 210 }, old, current, 10)).toBeCloseTo(0.25)
    expect(segmentCapsuleHitFraction({ x: 0, y: 211 }, { x: 400, y: 211 }, old, current, 10)).toBeNull()
  })

  test('diagonal capsule and motion reversal produce the same shape', () => {
    const old = { x: 50, y: 50 }
    const current = { x: 150, y: 150 }
    const start = { x: 0, y: 100 }
    const end = { x: 200, y: 100 }
    const fraction = segmentCapsuleHitFraction(start, end, old, current, 10)
    expect(fraction).toBeCloseTo((100 - 10 * Math.sqrt(2)) / 200)
    expect(segmentCapsuleHitFraction(start, end, current, old, 10)).toBeCloseTo(fraction!)
  })

  test('swept broad phase admits old contact without accepting rounded AABB corners', () => {
    const old = { x: 100, y: 100 }
    const current = { x: 100, y: 200 }
    expect(segmentMayHitSweptCircleByAabb({ x: 0, y: 100 }, { x: 400, y: 100 }, old, current, 10)).toBe(true)
    expect(segmentMayHitSweptCircleByAabb({ x: 0, y: 300 }, { x: 400, y: 300 }, old, current, 10)).toBe(false)
    expect(segmentCapsuleHitFraction({ x: 109, y: 90 }, { x: 111, y: 90 }, old, current, 10)).toBeNull()
  })
})

describe('moving entities and fresh input', () => {
  test('physics captures independent previous centers only for sliceable objects', () => {
    const { state } = setup()
    const moving = fruit('moving', 100, 100)
    moving.velocity = { x: 60, y: 6000 }
    state.world.entities[moving.id] = moving
    const positions = new Map<string, Vec2>()
    stepPhysicsSystem(state, 16, positions)
    expect(positions.get(moving.id)).toEqual({ x: 100, y: 100 })
    expect(moving.position.y).toBe(196)
    expect(positions.get(moving.id)).not.toBe(moving.position)
  })

  test('horizontal swipe at the last drawn center cuts fast vertical fruit', () => {
    const { engine, state } = setup()
    const moving = fruit('moving', 100, 100)
    moving.velocity.y = 6000
    state.world.entities[moving.id] = moving
    engine.setInputTrails([swipe()])
    engine.stepOnce()
    expect(state.run.stats.fruitSliced).toBe(1)
    expect(state.world.entities[moving.id]).toBeUndefined()
  })

  test('motion past a stationary pointer cannot cut fruit', () => {
    const { engine, state } = setup()
    const moving = fruit('moving', 100, 100)
    moving.velocity.y = 6000
    state.world.entities[moving.id] = moving
    engine.setInputTrails([{ pointerId: 1, points: [{ x: 100, y: 150, tMs: 0 }, { x: 100, y: 150, tMs: 20 }] }])
    engine.stepOnce()
    expect(state.run.stats.fruitSliced).toBe(0)
    expect(state.world.entities[moving.id]).toBeDefined()
  })

  test('consumed blade history does not cut newly moving fruit on later ticks', () => {
    const { engine, state } = setup()
    engine.setInputTrails([swipe()])
    engine.stepOnce()
    const moving = fruit('new-fruit', 100, 100)
    moving.velocity.y = 6000
    state.world.entities[moving.id] = moving
    engine.stepOnce()
    expect(state.run.stats.fruitSliced).toBe(0)
    expect(state.world.entities[moving.id]).toBeDefined()
  })

  test('direct detector callers keep stationary-circle compatibility and skip end-only markers', () => {
    const { state } = setup()
    const item = fruit('fruit', 100, 100)
    state.world.entities[item.id] = item
    detectSliceEvents(state, [{ pointerId: 1, strokeId: 4, ended: true, points: [] }, { ...swipe(), strokeId: 4 }])
    expect(state.world.sliceEvents).toHaveLength(1)
    expect(state.world.sliceEvents[0].strokeId).toBe(4)
    expect(state.world.sliceEvents[0].atMs).toBeCloseTo(4.5)
    expect(state.world.sliceEvents[0].hitPosition).toEqual({ x: 90, y: 100 })
  })
})

describe('canonical contacts', () => {
  test('all candidate-map permutations give spatial fruit/bomb order', () => {
    for (const order of permutations(['first', 'bomb', 'last'])) {
      const { state } = setup('classic')
      const entities = {
        first: fruit('first', 100, 100),
        bomb: createBombEntity({ ...motion, id: 'bomb', position: { x: 200, y: 100 } }),
        last: fruit('last', 300, 100),
      }
      for (const name of order) {
        const item = entities[name as keyof typeof entities]
        state.world.entities[item.id] = item
      }
      detectSliceEvents(state, [swipe()])
      expect(state.world.sliceEvents.map((event) => event.entityId)).toEqual(['first', 'bomb', 'last'])
    }
  })

  test('Classic outcomes depend on bomb position rather than candidate insertion order', () => {
    for (const order of permutations(['first', 'bomb', 'last'])) {
      const { engine, state } = setup('classic')
      const entities = {
        first: fruit('first', 100, 100),
        bomb: createBombEntity({ ...motion, id: 'bomb', position: { x: 200, y: 100 } }),
        last: fruit('last', 300, 100),
      }
      for (const name of order) {
        const item = entities[name as keyof typeof entities]
        state.world.entities[item.id] = item
      }
      engine.setInputTrails([swipe()])
      engine.stepOnce()
      expect(state.phase).toBe('game-over')
      expect(state.run.stats.fruitSliced).toBe(1)
      expect(state.run.stats.bombHits).toBe(1)
      expect(state.world.entities.last).toBeDefined()
    }
  })

  test('overlapping entity ties use stable ID regardless of insertion order', () => {
    const { state } = setup()
    for (const id of ['b', 'a']) state.world.entities[id] = fruit(id, 100, 100)
    detectSliceEvents(state, [swipe()])
    expect(state.world.sliceEvents.map((event) => event.entityId)).toEqual(['a', 'b'])
  })

  test('overlapping pointers choose first contact time then stable gesture ID', () => {
    const { state } = setup()
    state.world.entities.fruit = fruit('fruit', 100, 100)
    const earlier = { ...swipe(2, 100, 0, 10), strokeId: 9 }
    const later = { ...swipe(1, 100, 0, 20), strokeId: 3 }
    for (const trails of [[later, earlier], [earlier, later]]) {
      detectSliceEvents(state, trails)
      expect(state.world.sliceEvents).toHaveLength(1)
      expect(state.world.sliceEvents[0].pointerId).toBe(2)
    }
    for (const trails of [[{ ...earlier, strokeId: 9 }, { ...earlier, pointerId: 1, strokeId: 3 }], [{ ...earlier, pointerId: 1, strokeId: 3 }, earlier]]) {
      detectSliceEvents(state, trails)
      expect(state.world.sliceEvents[0].strokeId).toBe(3)
    }
  })
})
