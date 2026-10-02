import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import type { GameState } from '../src/game/types'

function gameplaySnapshot(state: Readonly<GameState>) {
  return {
    entities: Object.values(state.world.entities).filter((entity) => ['fruit', 'bomb', 'power-up'].includes(entity.kind)),
    spawn: state.world.spawn,
    rngCalls: state.run.rngCalls,
    score: state.score.current,
    stats: state.run.stats,
  }
}

describe('independent deterministic simulation', () => {
  test('cosmetic effects cannot alter gameplay ids, launch trajectories, spawn cadence or score', () => {
    const withEffects = createGameEngine({ mode: 'zen', seed: 72, effectsEnabled: true })
    const withoutEffects = createGameEngine({ mode: 'zen', seed: 72, effectsEnabled: false })
    withEffects.start()
    withoutEffects.start()
    let sliced = false
    for (let tick = 0; tick < 900; tick++) {
      if (!sliced && tick > 20) {
        const fruit = Object.values(withEffects.getState().world.entities).find((entity) => entity.kind === 'fruit')
        if (fruit) {
          const trail = { pointerId: 1, points: [
            { x: fruit.position.x - fruit.radius * 2, y: fruit.position.y, tMs: tick * 17 },
            { x: fruit.position.x + fruit.radius * 2, y: fruit.position.y, tMs: tick * 17 + 10 },
          ] }
          withEffects.setInputTrails([trail])
          withoutEffects.setInputTrails([trail])
          sliced = true
        }
      }
      withEffects.stepOnce()
      withoutEffects.stepOnce()
      expect(gameplaySnapshot(withEffects.getState())).toEqual(gameplaySnapshot(withoutEffects.getState()))
    }
    expect(withEffects.getState().run.stats.fruitSliced).toBe(1)
    expect(withEffects.getState().run.cosmeticRngCalls).toBeGreaterThan(0)
    expect(withoutEffects.getState().run.cosmeticRngCalls).toBe(0)
  })

  test('starting and resetting another engine cannot disturb the first engine entity ids', () => {
    const engine = createGameEngine({ mode: 'zen', seed: 6 })
    const reference = createGameEngine({ mode: 'zen', seed: 6 })
    const other = createGameEngine({ mode: 'classic', seed: 99 })
    engine.start()
    reference.start()
    for (let tick = 0; tick < 400; tick++) {
      engine.stepOnce()
      other.reset({ seed: tick + 1 })
      other.start()
      other.stepOnce()
      reference.stepOnce()
      expect(gameplaySnapshot(engine.getState())).toEqual(gameplaySnapshot(reference.getState()))
    }
    expect(engine.getState().world.spawn.wavesSpawned).toBeGreaterThan(3)
  })

  test('same seed replay restores gameplay sequences despite the previous run effects', () => {
    const engine = createGameEngine({ mode: 'zen', seed: 17 })
    engine.start()
    for (let tick = 0; tick < 200; tick++) engine.stepOnce()
    const first = JSON.stringify(gameplaySnapshot(engine.getState()))
    engine.reset({ seed: 17 })
    engine.start()
    for (let tick = 0; tick < 200; tick++) engine.stepOnce()
    expect(JSON.stringify(gameplaySnapshot(engine.getState()))).toBe(first)
  })
})
