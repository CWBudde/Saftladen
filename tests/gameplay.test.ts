import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createTrailTracker } from '../src/game/input/trailTracker'
import { createBombEntity, createFruitEntity } from '../src/game/model'
import { closestPointOnSegment } from '../src/game/systems/collision'
import { detectSliceEvents } from '../src/game/systems/sliceDetectSystem'
import { stepSpawnSystem } from '../src/game/systems/spawnSystem'
import { stepModeSystem } from '../src/game/systems/modeSystem'
import { createSeededRng } from '../src/game/engine/rng'
import type { GameState, SliceTrail } from '../src/game/types'

function setup(mode: 'classic' | 'arcade' | 'zen' = 'zen') {
  const engine = createGameEngine({ mode, seed: 42 })
  engine.start()
  const state = engine.getState() as GameState
  state.world.spawn.nextWaveAtMs = Number.POSITIVE_INFINITY
  return { engine, state }
}

function fruitAt(x = 100, y = 100) {
  return createFruitEntity({
    fruitType: 'apple', color: '#ef4444', position: { x, y }, velocity: { x: 0, y: 0 },
    rotationRad: 0, angularVelocityRadPerS: 0, radius: 20,
  })
}

const swipe: SliceTrail = {
  pointerId: 1,
  points: [{ x: 0, y: 100, tMs: 0 }, { x: 1000, y: 100, tMs: 20 }],
}

describe('fresh blade input', () => {
  test('fast pointer down/move/up survives until consumed once', () => {
    const tracker = createTrailTracker()
    tracker.beginTrail(1, { x: 0, y: 100, tMs: 0 })
    tracker.appendPoint(1, { x: 100, y: 100, tMs: 20 })
    tracker.endTrail(1, { x: 200, y: 100, tMs: 30 })
    expect(tracker.hasTrail(1)).toBe(false)
    expect(tracker.drainSliceTrails(40)).toHaveLength(2)
    expect(tracker.drainSliceTrails(40)).toHaveLength(0)
    expect(tracker.getActiveTrails(40)).toHaveLength(1)
    expect(tracker.getActiveTrails(200)).toHaveLength(0)
  })

  test('idle visuals expire while active pointers can start a fresh segment', () => {
    const tracker = createTrailTracker()
    tracker.beginTrail(1, { x: 0, y: 100, tMs: 0 })
    tracker.appendPoint(1, { x: 100, y: 100, tMs: 20 })
    expect(tracker.getActiveTrails(200)).toHaveLength(0)
    expect(tracker.drainSliceTrails(200)).toHaveLength(0)
    tracker.appendPoint(1, { x: 300, y: 100, tMs: 220 })
    const segments = tracker.drainSliceTrails(220)
    expect(segments).toHaveLength(1)
    expect(segments[0].points[0].x).toBe(100)
  })

  test('quick consecutive swipes using the same pointer id are both retained', () => {
    const tracker = createTrailTracker()
    tracker.beginTrail(1, { x: 0, y: 0, tMs: 0 })
    tracker.endTrail(1, { x: 100, y: 0, tMs: 10 })
    tracker.beginTrail(1, { x: 200, y: 0, tMs: 20 })
    tracker.endTrail(1, { x: 300, y: 0, tMs: 30 })
    expect(tracker.drainSliceTrails(40)).toHaveLength(2)
  })

  test('velocity threshold honors sensitivity and viewport scale', () => {
    const countAt = (distance: number, sensitivity = 1, scale = 1) => {
      const tracker = createTrailTracker()
      tracker.setSliceSensitivity(sensitivity)
      tracker.setViewportScale(scale)
      tracker.beginTrail(1, { x: 0, y: 0, tMs: 0 })
      tracker.appendPoint(1, { x: distance, y: 0, tMs: 100 })
      return tracker.drainSliceTrails(100).length
    }
    expect(countAt(0)).toBe(0)
    expect(countAt(10)).toBe(0)
    expect(countAt(15)).toBe(1)
    expect(countAt(10, 2)).toBe(1)
    expect(countAt(15, 0.5)).toBe(0)
    expect(countAt(4, 1, 0.25)).toBe(1)
  })

  test('cancel and clear discard pending movement for the affected pointers', () => {
    const tracker = createTrailTracker()
    for (const id of [1, 2]) {
      tracker.beginTrail(id, { x: 0, y: 0, tMs: 0 })
      tracker.appendPoint(id, { x: 100, y: 0, tMs: 20 })
    }
    tracker.cancelTrail(1)
    expect(tracker.drainSliceTrails(20).map((trail) => trail.pointerId)).toEqual([2])
    tracker.appendPoint(2, { x: 200, y: 0, tMs: 40 })
    tracker.clear()
    expect(tracker.drainSliceTrails(40)).toHaveLength(0)
  })

  test('engine retains input through frames without a step and never replays it', () => {
    const { engine, state } = setup()
    const fruit = fruitAt()
    state.world.entities[fruit.id] = fruit
    engine.setInputTrails([swipe])
    expect(engine.advanceBy(4)).toBe(0)
    engine.setInputTrails([])
    expect(engine.advanceBy(14)).toBe(1)
    expect(state.score.current).toBe(10)
    const nextFruit = fruitAt()
    state.world.entities[nextFruit.id] = nextFruit
    engine.advanceBy(100)
    expect(state.score.current).toBe(10)
    expect(state.world.entities[nextFruit.id]).toBeDefined()
  })

  test.each([30, 60, 120])('same motion cuts once at %i Hz', (frameRate) => {
    const { engine, state } = setup()
    const fruit = fruitAt()
    state.world.entities[fruit.id] = fruit
    engine.setInputTrails([swipe])
    for (let i = 0; i < frameRate; i++) engine.advanceBy(1000 / frameRate)
    expect(state.score.current).toBe(10)
  })

  test('pause/resume and explicit clear prevent queued input leaking into the next phase', () => {
    const { engine, state } = setup()
    const fruit = fruitAt()
    state.world.entities[fruit.id] = fruit
    engine.setInputTrails([swipe])
    engine.pause()
    engine.resume()
    engine.stepOnce()
    expect(state.score.current).toBe(0)
    engine.setInputTrails([swipe])
    engine.clearInputTrails()
    engine.stepOnce()
    expect(state.score.current).toBe(0)
  })

  test('cancelling one pointer clears engine input queued on a no-step frame and preserves other pointers', () => {
    const { engine, state } = setup()
    const cancelledFruit = fruitAt(100, 100)
    const validFruit = fruitAt(100, 300)
    state.world.entities[cancelledFruit.id] = cancelledFruit
    state.world.entities[validFruit.id] = validFruit
    engine.setInputTrails([
      swipe,
      { pointerId: 2, points: [{ x: 0, y: 300, tMs: 0 }, { x: 1000, y: 300, tMs: 20 }] },
    ])
    expect(engine.advanceBy(4)).toBe(0)
    engine.clearInputTrails(1)
    expect(engine.advanceBy(14)).toBe(1)
    expect(state.score.current).toBe(10)
    expect(state.world.entities[cancelledFruit.id]).toBeDefined()
    expect(state.world.entities[validFruit.id]).toBeUndefined()
  })
})

describe('run completion', () => {
  test.each(['arcade', 'zen'] as const)('%s stops at its deadline during catch-up', (mode) => {
    const { engine, state } = setup(mode)
    state.modeState[mode].remainingMs = 5
    const steps = engine.advanceBy(100)
    expect(steps).toBe(1)
    expect(state.phase).toBe('game-over')
    expect(state.modeState[mode].remainingMs).toBe(0)
    expect(state.world.elapsedMs).toBe(5)
    expect(engine.getDiagnostics().accumulatorMs).toBe(0)
    expect(engine.advanceBy(100)).toBe(0)
    engine.stepOnce()
    expect(state.run.simulationSteps).toBe(1)
  })

  test('classic bomb stops remaining fixed steps and emits one terminal update', () => {
    const { engine, state } = setup('classic')
    const bomb = createBombEntity({
      color: '#111827', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 },
      rotationRad: 0, angularVelocityRadPerS: 0, radius: 20,
    })
    state.world.entities[bomb.id] = bomb
    const laterFruit = fruitAt(200)
    state.world.entities[laterFruit.id] = laterFruit
    let terminalUpdates = 0
    engine.subscribe((current) => { if (current.phase === 'game-over') terminalUpdates++ })
    engine.setInputTrails([swipe])
    expect(engine.advanceBy(100)).toBe(1)
    expect(state.phase).toBe('game-over')
    expect(state.run.simulationSteps).toBe(1)
    expect(terminalUpdates).toBe(1)
    expect(state.score.current).toBe(0)
    expect(state.world.entities[laterFruit.id]).toBeDefined()
  })
})

describe('collision feedback and spawns', () => {
  test('best-score storage writes once per advance and once for a new stepOnce record', () => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const writes: string[] = []
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: (_key: string, value: string) => writes.push(value) },
    })
    try {
      const { engine, state } = setup()
      for (const x of [100, 200, 300]) {
        const fruit = fruitAt(x)
        state.world.entities[fruit.id] = fruit
      }
      engine.setInputTrails([swipe])
      engine.advanceBy(100)
      expect(state.score.best).toBe(45)
      expect(writes).toEqual(['45'])
      engine.advanceBy(100)
      expect(writes).toEqual(['45'])
      const fruit = fruitAt()
      state.world.entities[fruit.id] = fruit
      engine.setInputTrails([swipe])
      engine.stepOnce()
      expect(writes).toEqual(['45', '55'])
    } finally {
      if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  test('wide swipe reports contact at fruit and keeps halves at source center', () => {
    const { engine, state } = setup()
    const fruit = fruitAt(100, 110)
    state.world.entities[fruit.id] = fruit
    detectSliceEvents(state, [swipe])
    expect(state.world.sliceEvents[0].hitPosition.x).toBeCloseTo(100 - Math.sqrt(300))
    expect(state.world.sliceEvents[0].hitPosition.y).toBe(100)
    engine.setInputTrails([swipe])
    engine.stepOnce()
    const halves = Object.values(state.world.entities).filter((entity) => entity.kind === 'fruit-half')
    expect(halves).toHaveLength(2)
    expect(halves.every((half) => half.position.x === 100 && Math.abs(half.position.y - 110) < 1)).toBe(true)
    expect(closestPointOnSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({ x: 0, y: 0 })
  })

  test('two pointers overlapping one fruit score it once', () => {
    const { engine, state } = setup()
    const fruit = fruitAt()
    state.world.entities[fruit.id] = fruit
    engine.setInputTrails([swipe, { ...swipe, pointerId: 2 }])
    engine.stepOnce()
    expect(state.score.current).toBe(10)
    expect(state.world.scoreFeedbackEvents).toHaveLength(1)
  })

  test('stationary segment touching a fruit does not slice', () => {
    const { state } = setup()
    const fruit = fruitAt()
    state.world.entities[fruit.id] = fruit
    detectSliceEvents(state, [{ pointerId: 1, points: [{ x: 100, y: 100, tMs: 0 }, { x: 100, y: 100, tMs: 20 }] }])
    expect(state.world.sliceEvents).toHaveLength(0)
  })

  test.each(['classic', 'zen'] as const)('%s never spawns inactive arcade power-ups', (mode) => {
    const { state } = setup(mode)
    const random = createSeededRng(7)
    for (let wave = 0; wave < 200; wave++) {
      state.world.elapsedMs = 30000 + wave * 1000
      state.world.spawn.nextWaveAtMs = 0
      stepSpawnSystem(state, random, stepModeSystem(state, 0))
      const all = [...Object.values(state.world.entities), ...state.world.spawn.pending.map((entry) => entry.entity)]
      expect(all.some((entity) => entity.kind === 'power-up')).toBe(false)
      state.world.entities = {}
      state.world.spawn.pending = []
    }
  })

  test('first three classic waves are fruit for every tested seed', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { state } = setup('classic')
      const random = createSeededRng(seed)
      for (let wave = 0; wave < 3; wave++) {
        state.world.elapsedMs = wave * 2000
        state.world.spawn.nextWaveAtMs = 0
        stepSpawnSystem(state, random, stepModeSystem(state, 0))
        expect(state.world.spawn.pending[0].entity.kind).toBe('fruit')
        state.world.spawn.pending = []
      }
    }
  })
})
