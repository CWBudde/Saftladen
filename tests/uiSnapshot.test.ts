import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { areGameUiSnapshotsEqual, selectGameUiSnapshot } from '../src/game/ui/viewModel'

describe('UI publication cadence', () => {
  test('subsecond timer ticks do not refresh React', () => {
    const engine = createGameEngine({ mode: 'zen', seed: 7 })
    engine.start()
    const snapshot = selectGameUiSnapshot(engine.getState())
    const sameSecond = { ...snapshot, elapsedMs: 500, zenRemainingMs: 90000 }
    expect(areGameUiSnapshotsEqual(snapshot, sameSecond)).toBe(true)
    expect(areGameUiSnapshotsEqual(sameSecond, { ...sameSecond, elapsedMs: 1000 })).toBe(false)
    expect(areGameUiSnapshotsEqual(sameSecond, { ...sameSecond, zenRemainingMs: 89999 })).toBe(false)
  })

  test('scores, power-ups and phase transitions publish immediately', () => {
    const engine = createGameEngine()
    engine.start()
    const snapshot = selectGameUiSnapshot(engine.getState())
    expect(areGameUiSnapshotsEqual(snapshot, { ...snapshot, score: 10 })).toBe(false)
    expect(areGameUiSnapshotsEqual(snapshot, { ...snapshot, activePowerUps: ['freeze'] })).toBe(false)
    engine.pause()
    const paused = selectGameUiSnapshot(engine.getState())
    expect(areGameUiSnapshotsEqual(snapshot, paused)).toBe(false)
    expect(paused.elapsedMs).toBe(engine.getState().world.elapsedMs)
  })
})
