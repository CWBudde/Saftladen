import { describe, expect, test } from 'bun:test'
import { createGameEngine, type GameEngine } from '../src/game/engine/gameEngine'
import type { GameState } from '../src/game/types'

function gameplaySnapshot(state: Readonly<GameState>) {
  return {
    entities: Object.values(state.world.entities).filter((entity) =>
      ['fruit', 'bomb', 'power-up'].includes(entity.kind),
    ),
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
        const fruit = Object.values(withEffects.getState().world.entities).find(
          (entity) => entity.kind === 'fruit',
        )
        if (fruit) {
          const trail = {
            pointerId: 1,
            points: [
              { x: fruit.position.x - fruit.radius * 2, y: fruit.position.y, tMs: tick * 17 },
              { x: fruit.position.x + fruit.radius * 2, y: fruit.position.y, tMs: tick * 17 + 10 },
            ],
          }
          withEffects.setInputTrails([trail])
          withoutEffects.setInputTrails([trail])
          sliced = true
        }
      }
      withEffects.stepOnce()
      withoutEffects.stepOnce()
      expect(gameplaySnapshot(withEffects.getState())).toEqual(
        gameplaySnapshot(withoutEffects.getState()),
      )
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

  test.each([17, 0, 2 ** 32 + 17])(
    'reset and direct restart replay gameplay and effects with seed %i',
    (seed) => {
      const engine = createGameEngine({ mode: 'zen', seed: 99 })
      const play = (current: GameEngine) => {
        for (let tick = 0; tick < 25; tick++) current.stepOnce()
        const fruit = Object.values(current.getState().world.entities).find(
          (entity) => entity.kind === 'fruit',
        )
        if (!fruit) throw new Error('Expected opening fruit')
        current.setInputTrails([
          {
            pointerId: 1,
            points: [
              { x: fruit.position.x - fruit.radius * 2, y: fruit.position.y, tMs: 420 },
              { x: fruit.position.x + fruit.radius * 2, y: fruit.position.y, tMs: 430 },
            ],
          },
        ])
        for (let tick = 0; tick < 15; tick++) current.stepOnce()
        const state = current.getState()
        expect(state.run.stats.fruitSliced).toBe(1)
        expect(state.run.cosmeticRngCalls).toBeGreaterThan(0)
        expect(
          Object.values(state.world.entities).some((entity) => entity.kind === 'fruit-half'),
        ).toBe(true)
        // Run identity and persisted best are metadata, outside deterministic replay.
        const run = { ...state.run, id: undefined }
        const score = { ...state.score, best: undefined }
        return JSON.stringify({ world: state.world, run, score, modeState: state.modeState })
      }

      engine.start({ seed })
      const firstRunId = engine.getState().run.id
      const first = play(engine)
      engine.setInputTrails([
        {
          pointerId: 2,
          points: [
            { x: 0, y: 600, tMs: 670 },
            { x: 1280, y: 600, tMs: 680 },
          ],
        },
      ])
      expect(engine.advanceBy(4)).toBe(0)
      engine.reset({ seed })
      expect(engine.getState().phase).toBe('idle')
      expect(engine.getState().run.seed).toBe(seed)
      expect(engine.getState().run.rngCalls).toBe(0)
      expect(engine.getState().run.cosmeticRngCalls).toBe(0)
      expect(engine.getDiagnostics()).toEqual({ accumulatorMs: 0, lastAdvanceSteps: 0 })
      engine.start()
      expect(engine.getState().run.id).not.toBe(firstRunId)
      expect(play(engine)).toBe(first)

      engine.markGameOver()
      engine.start({ seed })
      expect(play(engine)).toBe(first)
    },
  )
})
