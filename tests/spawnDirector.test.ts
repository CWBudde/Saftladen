import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createSeededRng } from '../src/game/engine/rng'
import { createBombEntity } from '../src/game/model'
import { stepDespawnSystem } from '../src/game/systems/despawnSystem'
import { getModeModifiers, stepModeSystem } from '../src/game/systems/modeSystem'
import { stepPhysicsSystem } from '../src/game/systems/physicsSystem'
import { getSpawnWavePlan, getTrajectoryEnvelope, hasSafeHorizontalClearance } from '../src/game/systems/spawnDirector'
import { stepSpawnSystem } from '../src/game/systems/spawnSystem'
import type { GameMode, GameState, Vec2 } from '../src/game/types'

function setup(mode: GameMode, bounds: Vec2 = { x: 1280, y: 720 }) {
  const engine = createGameEngine({ mode, seed: 42, effectsEnabled: false })
  engine.setWorldBounds(bounds)
  engine.start()
  return engine.getState() as GameState
}

describe('authored spawn director', () => {
  test.each(['classic', 'arcade', 'zen'] as const)('%s opens with three solo fruit waves across 100 seeds and portrait/landscape', mode => {
    const failures: unknown[] = []
    for (const bounds of [{ x: 720, y: 1558 }, { x: 1280, y: 720 }]) {
      for (let seed = 1; seed <= 100; seed++) {
        const state = setup(mode, bounds)
        const random = createSeededRng(seed)
        for (let wave = 0; wave < 3; wave++) {
          state.world.elapsedMs = wave * 4000
          state.world.spawn.nextWaveAtMs = 0
          stepSpawnSystem(state, random, getModeModifiers(state))
          const entries = state.world.spawn.pending
          if (entries.length !== 1 || entries[0].entity.kind !== 'fruit') failures.push({ mode, seed, wave, entries })
          state.world.spawn.pending = []
        }
      }
    }
    expect(failures).toEqual([])
  })

  test('six-beat patterns include simultaneous combo groups and spaced recovery', () => {
    const state = setup('classic')
    const plans = Array.from({ length: 9 }, (_, index) => {
      state.world.spawn.wavesSpawned = index
      return getSpawnWavePlan(state)
    })
    expect(plans.map(plan => plan.pattern)).toEqual(['opening', 'opening', 'opening', 'fan', 'ladder', 'alternating', 'group', 'group', 'recovery'])
    expect(plans[3].fruitCount).toBe(3)
    expect(plans[6].staggerMs).toBe(0)
    expect(plans[4].staggerMs).toBe(110)
    expect(plans[5].staggerMs).toBe(160)
    expect(plans[8].intervalMs).toBeGreaterThan(plans[7].intervalMs)
    expect(plans[8].hazardChance).toBe(0)
  })

  test('Classic ramps, Arcade crescendos, and Zen remains relaxed', () => {
    const plans = (mode: GameMode) => {
      const state = setup(mode)
      state.world.spawn.wavesSpawned = 6
      const early = getSpawnWavePlan(state)
      state.world.elapsedMs = 90000
      state.modeState.arcade.remainingMs = 0
      return { early, late: getSpawnWavePlan(state) }
    }
    const classic = plans('classic'), arcade = plans('arcade'), zen = plans('zen')
    expect(classic.late.fruitCount).toBe(5)
    expect(arcade.late.fruitCount).toBe(6)
    expect(classic.late.intervalMs).toBeLessThan(classic.early.intervalMs)
    expect(arcade.late.intervalMs).toBeLessThan(arcade.early.intervalMs)
    expect(zen.early).toEqual(zen.late)
    expect([classic.late.hazardBudget, arcade.late.hazardBudget, zen.late.hazardBudget]).toEqual([2, 1, 0])
  })

  test('every seeded wave preserves a safe fruit corridor and active/queued hazard budget', () => {
    const failures: unknown[] = []
    const totals: Record<GameMode, { fruit: number; bomb: number; waves: number }> = {
      classic: { fruit: 0, bomb: 0, waves: 0 }, arcade: { fruit: 0, bomb: 0, waves: 0 }, zen: { fruit: 0, bomb: 0, waves: 0 },
    }
    for (const mode of ['classic', 'arcade', 'zen'] as const) {
      for (const bounds of [{ x: 1280, y: 720 }, { x: 720, y: 1558 }, { x: 1558, y: 720 }]) {
        for (let seed = 1; seed <= 30; seed++) {
          const state = setup(mode, bounds)
          const random = createSeededRng(seed)
          for (let elapsed = 50; elapsed <= 60000; elapsed += 50) {
            state.world.elapsedMs = elapsed
            const modifiers = stepModeSystem(state, 50)
            const previousWaves = state.world.spawn.wavesSpawned
            stepSpawnSystem(state, random, modifiers)
            if (state.world.spawn.wavesSpawned !== previousWaves) {
              totals[mode].waves++
              const spawned = state.world.spawn.pending.filter(entry => entry.spawnAtMs >= elapsed)
              totals[mode].fruit += spawned.filter(entry => entry.entity.kind === 'fruit').length
              totals[mode].bomb += spawned.filter(entry => entry.entity.kind === 'bomb').length
              const entities = [...Object.values(state.world.entities), ...state.world.spawn.pending.map(entry => entry.entity)]
              const bombs = entities.filter(entity => entity.kind === 'bomb')
              const targets = entities.filter(entity => entity.kind === 'fruit' || entity.kind === 'power-up')
              if (bombs.length > getSpawnWavePlan(state).hazardBudget || entities.filter(entity => entity.kind === 'fruit').length > getSpawnWavePlan(state).fruitBudget || targets.some(target => bombs.some(bomb => !hasSafeHorizontalClearance(target, bomb, bounds)))) {
                failures.push({ mode, seed, bounds, elapsed })
              }
              for (const { entity } of spawned) {
                const envelope = getTrajectoryEnvelope(entity, bounds)
                if (envelope.minX < 0 || envelope.maxX > bounds.x || envelope.minY < 0) failures.push({ mode, seed, elapsed, envelope })
              }
            }
            stepPhysicsSystem(state, 50 * modifiers.physicsDtScale)
            stepDespawnSystem(state)
          }
        }
      }
    }
    expect(failures).toEqual([])
    expect(totals.classic.bomb).toBeGreaterThan(0)
    expect(totals.arcade.bomb).toBeGreaterThan(0)
    expect(totals.zen.bomb).toBe(0)
    expect(totals.arcade.fruit).toBeGreaterThan(totals.classic.fruit)
    expect(totals.classic.fruit).toBeGreaterThan(totals.zen.fruit)
    expect(totals.arcade.waves).toBeGreaterThan(totals.classic.waves)
  })

  test('combined Freeze/Frenzy and queued fruit respect the explicit thirty-fruit ceiling', () => {
    const state = setup('arcade', { x: 720, y: 1558 })
    const random = createSeededRng(17)
    let peak = 0
    for (let elapsed = 50; elapsed <= 20000; elapsed += 50) {
      state.world.elapsedMs = elapsed
      state.modeState.arcade.powerUpTimers.freezeMs = 4500
      state.modeState.arcade.powerUpTimers.frenzyMs = 5200
      const modifiers = stepModeSystem(state, 50)
      stepSpawnSystem(state, random, modifiers)
      peak = Math.max(peak, [...Object.values(state.world.entities), ...state.world.spawn.pending.map(entry => entry.entity)].filter(entity => entity.kind === 'fruit').length)
      stepPhysicsSystem(state, 50 * modifiers.physicsDtScale)
      stepDespawnSystem(state)
    }
    expect(peak).toBeGreaterThan(18)
    expect(peak).toBeLessThanOrEqual(30)
  })

  test('a hazard occupying one slot defers the complete advertised combo group', () => {
    const state = setup('classic')
    state.world.spawn.wavesSpawned = 3
    const bomb = createBombEntity({
      color: '#000', position: { x: 900, y: 300 }, velocity: { x: 0, y: 0 },
      radius: 30, rotationRad: 0, angularVelocityRadPerS: 0,
    })
    state.world.entities[bomb.id] = bomb
    stepSpawnSystem(state, createSeededRng(9), getModeModifiers(state))
    expect(state.world.spawn.pending).toHaveLength(0)
    expect(state.world.spawn.wavesSpawned).toBe(4)
    expect(state.world.entities[bomb.id]).toBe(bomb)
  })
})
