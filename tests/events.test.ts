import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createBombEntity, createFruitEntity, createPowerUpEntity } from '../src/game/model'
import type { GamePresentationEvent, GameState } from '../src/game/types'

const motion = { velocity: { x: 0, y: 0 }, rotationRad: 0, angularVelocityRadPerS: 0, radius: 20 }
const swipe = {
  pointerId: 1,
  points: [
    { x: 0, y: 100, tMs: 0 },
    { x: 1000, y: 100, tMs: 10 },
  ],
}

function setup(mode: 'classic' | 'arcade' | 'zen' = 'arcade') {
  const engine = createGameEngine({ mode, seed: 1, fixedDtMs: 10 })
  const batches: (readonly GamePresentationEvent[])[] = []
  engine.subscribeEvents((batch) => batches.push(batch))
  engine.start()
  const state = engine.getState() as GameState
  state.world.spawn.nextWaveAtMs = Infinity
  return { engine, state, batches }
}

describe('presentation events', () => {
  test('catch-up preserves events from different ticks in one ordered immutable batch', () => {
    const { engine, state, batches } = setup()
    const fruit = createFruitEntity({
      ...motion,
      fruitType: 'apple',
      color: '#f00',
      position: { x: 100, y: 100 },
    })
    const missed = createFruitEntity({
      ...motion,
      fruitType: 'orange',
      color: '#f90',
      position: { x: 500, y: 1000 },
    })
    state.world.entities[fruit.id] = fruit
    state.world.entities[missed.id] = missed
    state.modeState.arcade.powerUpTimers.freezeMs = 25
    state.modeState.arcade.remainingMs = 35
    engine.setInputTrails([swipe])
    expect(engine.advanceBy(100)).toBe(4)
    expect(batches).toHaveLength(2)
    const events = batches[1]
    expect(events.map((event) => event.type)).toEqual([
      'fruit-slice',
      'fruit-miss',
      'power-up-expired',
      'run-end',
    ])
    expect(events.map((event) => event.atMs)).toEqual([10, 10, 30, 35])
    expect(events.map((event) => event.id)).toEqual([2, 3, 4, 5])
    expect(events.every((event) => event.runId === state.run.id)).toBe(true)
    expect(Object.isFrozen(events)).toBe(true)
    expect(events.every(Object.isFrozen)).toBe(true)
    const cut = events[0]
    if (cut.type !== 'fruit-slice') throw new Error('Expected slice')
    expect(Object.isFrozen(cut.position)).toBe(true)
    expect(Object.isFrozen(cut.direction)).toBe(true)
    const end = events[3]
    if (end.type !== 'run-end') throw new Error('Expected end')
    expect(end.stats).toEqual({
      fruitSliced: 1,
      missedFruits: 1,
      bombHits: 0,
      peakCombo: 1,
      strokesAttempted: 1,
      successfulStrokes: 1,
      peakStrokeCombo: 1,
    })
    expect(Object.isFrozen(end.stats)).toBe(true)
    state.run.stats.fruitSliced = 500
    engine.reset()
    expect(end.stats.fruitSliced).toBe(1)
    expect(end.durationMs).toBe(35)
    expect(end.score).toBe(10)
  })

  test('arcade bomb events report actual hits and penalty even when score does not increase', () => {
    const { engine, state, batches } = setup()
    state.score.current = 50
    const bomb = createBombEntity({ ...motion, color: '#000', position: { x: 100, y: 100 } })
    state.world.entities[bomb.id] = bomb
    engine.setInputTrails([swipe])
    engine.stepOnce()
    const hit = batches[1][0]
    expect(hit.type).toBe('bomb-hit')
    if (hit.type !== 'bomb-hit') throw new Error('Expected bomb')
    expect(hit.penalty).toBe(25)
    expect(state.run.stats.bombHits).toBe(1)
    expect(state.score.current).toBe(25)
    engine.markGameOver()
    const end = batches[2][0]
    if (end.type !== 'run-end') throw new Error('Expected end')
    expect(end.stats.bombHits).toBe(1)
  })

  test('Classic bomb emits exactly one hit followed by one end; later fruit never scores', () => {
    const { engine, state, batches } = setup('classic')
    const bomb = createBombEntity({ ...motion, color: '#000', position: { x: 100, y: 100 } })
    const fruit = createFruitEntity({
      ...motion,
      fruitType: 'apple',
      color: '#f00',
      position: { x: 200, y: 100 },
    })
    state.world.entities[bomb.id] = bomb
    state.world.entities[fruit.id] = fruit
    engine.setInputTrails([swipe])
    engine.advanceBy(100)
    expect(batches[1].map((event) => event.type)).toEqual(['bomb-hit', 'run-end'])
    expect(state.run.stats).toEqual({
      fruitSliced: 0,
      missedFruits: 0,
      bombHits: 1,
      peakCombo: 0,
      strokesAttempted: 1,
      successfulStrokes: 0,
      peakStrokeCombo: 0,
    })
    engine.markGameOver()
    engine.advanceBy(100)
    expect(batches).toHaveLength(2)
  })

  test('power-ups emit activation and expiry without a fake fruit slice', () => {
    const { engine, state, batches } = setup()
    const powerUp = createPowerUpEntity({
      ...motion,
      powerUpType: 'freeze',
      color: '#00f',
      position: { x: 100, y: 100 },
    })
    state.world.entities[powerUp.id] = powerUp
    engine.setInputTrails([swipe])
    engine.stepOnce()
    const activation = batches[1][0]
    expect(activation.type).toBe('power-up-activated')
    if (activation.type !== 'power-up-activated') throw new Error('Expected activation')
    expect(activation.durationMs).toBeGreaterThan(0)
    expect(state.run.stats.fruitSliced).toBe(0)
    state.modeState.arcade.powerUpTimers.freezeMs = 5
    engine.advanceBy(100)
    expect(batches[2].map((event) => event.type)).toEqual(['power-up-expired'])
    engine.advanceBy(100)
    expect(batches).toHaveLength(3)
  })

  test('run ids survive snapshots, change per run, and differ between engines', () => {
    const { engine, state, batches } = setup('zen')
    const firstRun = state.run.id
    engine.start()
    expect(engine.getState().run.id).toBe(firstRun)
    expect(batches).toHaveLength(1)
    engine.markGameOver()
    engine.start({ seed: 1 })
    expect(engine.getState().run.id).not.toBe(firstRun)
    expect(engine.getState().run.stats).toEqual({
      fruitSliced: 0,
      missedFruits: 0,
      bombHits: 0,
      peakCombo: 0,
      strokesAttempted: 0,
      successfulStrokes: 0,
      peakStrokeCombo: 0,
    })
    const other = setup('zen')
    expect(other.state.run.id).not.toBe(firstRun)
  })

  test('abandoning/resetting runs does not emit reward settlement; unsubscribe stops delivery', () => {
    const { engine, batches } = setup()
    let deliveries = 0
    const unsubscribe = engine.subscribeEvents(() => deliveries++)
    engine.stop()
    engine.reset()
    expect(batches.flat().filter((event) => event.type === 'run-end')).toHaveLength(0)
    engine.start()
    expect(deliveries).toBe(1)
    unsubscribe()
    engine.markGameOver()
    expect(deliveries).toBe(1)
  })
})
