import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createSeededRng } from '../src/game/engine/rng'
import { createBombEntity, createFruitEntity, createPowerUpEntity } from '../src/game/model'
import { activatePowerUp, getModeModifiers, stepModeSystem } from '../src/game/systems/modeSystem'
import { stepSpawnSystem } from '../src/game/systems/spawnSystem'
import type { GameState, PresentationEventPayload } from '../src/game/types'

function setup() {
  const engine = createGameEngine({ mode: 'arcade', effectsEnabled: false })
  engine.start()
  return { engine, state: engine.getState() as GameState }
}
const motion = { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 }, rotationRad: 0, angularVelocityRadPerS: 0, radius: 30 }

describe('power-up refresh and independent clocks', () => {
  test('repeat pickups refresh fixed durations without additive stacking; different effects coexist', () => {
    const { state } = setup()
    activatePowerUp(state, 'freeze')
    activatePowerUp(state, 'frenzy')
    activatePowerUp(state, 'double-points')
    expect(state.modeState.arcade.powerUpTimers).toEqual({ freezeMs: 4500, frenzyMs: 5200, doublePointsMs: 6500 })
    stepModeSystem(state, 1000)
    activatePowerUp(state, 'freeze')
    activatePowerUp(state, 'freeze')
    expect(state.modeState.arcade.powerUpTimers).toEqual({ freezeMs: 4500, frenzyMs: 4200, doublePointsMs: 5500 })
    expect(getModeModifiers(state)).toMatchObject({ physicsDtScale: 0.45, spawnRateScale: 1.85, suppressBombSpawns: true, scoreMultiplier: 2 })
  })

  test('Freeze slows entities but round, spawn scheduling and pickup durations use simulation clock', () => {
    const { engine, state } = setup()
    const fruit = createFruitEntity({ ...motion, fruitType: 'apple', color: '#f00', velocity: { x: 100, y: 0 } })
    state.world.entities[fruit.id] = fruit
    state.world.spawn.nextWaveAtMs = 100
    activatePowerUp(state, 'freeze')
    engine.stepOnce(100)
    expect(state.world.elapsedMs).toBe(100)
    expect(state.modeState.arcade.remainingMs).toBe(59900)
    expect(state.modeState.arcade.powerUpTimers.freezeMs).toBe(4400)
    expect(fruit.position.x).toBeCloseTo(104.5)
    expect(state.world.spawn.wavesSpawned).toBe(1)
    expect(getModeModifiers(state).spawnRateScale).toBe(0.72)
  })

  test('global freeze and pause suspend runtime clocks; explicit stepOnce still advances one manual step', () => {
    const { engine, state } = setup()
    state.world.spawn.nextWaveAtMs = Infinity
    activatePowerUp(state, 'freeze')
    engine.setTimeScalePreset('freeze')
    expect(engine.advanceBy(100)).toBe(0)
    expect(state.world.elapsedMs).toBe(0)
    expect(state.modeState.arcade.powerUpTimers.freezeMs).toBe(4500)
    engine.stepOnce(100)
    expect(state.world.elapsedMs).toBe(100)
    engine.pause()
    engine.advanceBy(100)
    engine.stepOnce(100)
    expect(state.world.elapsedMs).toBe(100)
  })

  test('Frenzy retires existing and queued bombs without changing fruit, score or bomb statistics', () => {
    const { state } = setup()
    const bomb = createBombEntity({ ...motion, color: '#000' })
    const queuedBomb = createBombEntity({ ...motion, color: '#000' })
    const fruit = createFruitEntity({ ...motion, fruitType: 'apple', color: '#f00' })
    state.world.entities[bomb.id] = bomb
    state.world.entities[fruit.id] = fruit
    state.world.spawn.pending.push({ spawnAtMs: 100, entity: queuedBomb })
    state.score.current = 100
    activatePowerUp(state, 'frenzy')
    expect(state.world.entities[bomb.id]).toBeUndefined()
    expect(state.world.entities[fruit.id]).toBe(fruit)
    expect(state.world.spawn.pending).toHaveLength(0)
    expect(state.score.current).toBe(100)
    expect(state.run.stats.bombHits).toBe(0)
    const random = createSeededRng(8)
    for (let wave = 0; wave < 40; wave++) {
      state.world.spawn.nextWaveAtMs = 0
      stepSpawnSystem(state, random, getModeModifiers(state))
    }
    expect(state.world.spawn.pending.some(entry => entry.entity.kind === 'bomb')).toBe(false)
  })

  test('expiry emits once per independent effect and restores modifiers without extending round', () => {
    const { state } = setup()
    const events: PresentationEventPayload[] = []
    activatePowerUp(state, 'freeze')
    activatePowerUp(state, 'frenzy')
    activatePowerUp(state, 'double-points')
    const before = state.modeState.arcade.remainingMs
    stepModeSystem(state, 6500, events)
    stepModeSystem(state, 50, events)
    expect(events.map(event => event.type === 'power-up-expired' ? event.powerUp : event.type)).toEqual(['freeze', 'frenzy', 'double-points'])
    expect(getModeModifiers(state)).toMatchObject({ physicsDtScale: 1, spawnRateScale: 1.25, suppressBombSpawns: false, scoreMultiplier: 1 })
    expect(state.modeState.arcade.remainingMs).toBe(before - 6550)
  })

  test.each([true, false])('same-step Frenzy follows physical contact order, pickup first = %s', pickupFirst => {
    const { engine, state } = setup()
    state.world.spawn.nextWaveAtMs = Infinity
    state.score.current = 100
    const pickup = createPowerUpEntity({ ...motion, powerUpType: 'frenzy', color: '#f90', position: { x: pickupFirst ? 100 : 200, y: 100 } })
    const bomb = createBombEntity({ ...motion, color: '#000', position: { x: pickupFirst ? 200 : 100, y: 100 } })
    const laterBomb = createBombEntity({ ...motion, color: '#000', position: { x: 300, y: 100 } })
    const queuedBomb = createBombEntity({ ...motion, color: '#000' })
    // Insert in reverse physical order to prove entity enumeration cannot decide it.
    state.world.entities[laterBomb.id] = laterBomb
    if (pickupFirst) {
      state.world.entities[bomb.id] = bomb
      state.world.entities[pickup.id] = pickup
    } else {
      state.world.entities[pickup.id] = pickup
      state.world.entities[bomb.id] = bomb
    }
    state.world.spawn.pending.push({ spawnAtMs: 1000, entity: queuedBomb })
    const events: PresentationEventPayload[] = []
    engine.subscribeEvents(batch => events.push(...batch))
    engine.setInputTrails([{ pointerId: 1, points: [{ x: 0, y: 100, tMs: 0 }, { x: 400, y: 100, tMs: 20 }] }])
    engine.stepOnce()
    expect(state.score.current).toBe(pickupFirst ? 115 : 65)
    expect(state.run.stats.bombHits).toBe(pickupFirst ? 0 : 1)
    expect(events.map(event => event.type)).toEqual(pickupFirst ? ['power-up-activated'] : ['bomb-hit', 'power-up-activated'])
    const hit = events.find(event => event.type === 'bomb-hit')
    if (hit?.type === 'bomb-hit') expect(hit.penalty).toBe(50)
    expect(state.world.entities[bomb.id]).toBeUndefined()
    expect(state.world.entities[laterBomb.id]).toBeUndefined()
    expect(state.world.spawn.pending).toHaveLength(0)
    expect(state.modeState.arcade.powerUpTimers.frenzyMs).toBe(5200)
    expect(state.world.lastBombHitAtMs).toBe(pickupFirst ? null : state.world.elapsedMs)
  })
})
