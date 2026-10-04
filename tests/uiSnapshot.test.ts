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
    expect(areGameUiSnapshotsEqual(sameSecond, { ...sameSecond, zenRemainingMs: 89999 })).toBe(true)
    expect(areGameUiSnapshotsEqual(sameSecond, { ...sameSecond, zenRemainingMs: 89000 })).toBe(
      false,
    )
  })

  test('scores, power-ups and phase transitions publish immediately', () => {
    const engine = createGameEngine()
    engine.start()
    const snapshot = selectGameUiSnapshot(engine.getState())
    expect(areGameUiSnapshotsEqual(snapshot, { ...snapshot, score: 10 })).toBe(false)
    expect(areGameUiSnapshotsEqual(snapshot, { ...snapshot, strokeCombo: 3 })).toBe(false)
    expect(areGameUiSnapshotsEqual(snapshot, { ...snapshot, streakMultiplier: 1.25 })).toBe(false)
    expect(areGameUiSnapshotsEqual(snapshot, { ...snapshot, activePowerUps: ['freeze'] })).toBe(
      false,
    )
    engine.pause()
    const paused = selectGameUiSnapshot(engine.getState())
    expect(areGameUiSnapshotsEqual(snapshot, paused)).toBe(false)
    expect(paused.elapsedMs).toBe(engine.getState().world.elapsedMs)
  })

  test('run statistics are copied and power-up countdowns publish on visible seconds', () => {
    const engine = createGameEngine({ mode: 'arcade' })
    engine.start()
    const snapshot = selectGameUiSnapshot(engine.getState())
    expect(snapshot.runId).toBe(engine.getState().run.id)
    expect(snapshot.stats).toEqual(engine.getState().run.stats)
    expect(snapshot.stats).not.toBe(engine.getState().run.stats)
    const powered = {
      ...snapshot,
      powerUpRemainingMs: { ...snapshot.powerUpRemainingMs, freeze: 5000 },
    }
    expect(
      areGameUiSnapshotsEqual(powered, {
        ...powered,
        powerUpRemainingMs: { ...powered.powerUpRemainingMs, freeze: 4900 },
      }),
    ).toBe(true)
    expect(
      areGameUiSnapshotsEqual(powered, {
        ...powered,
        powerUpRemainingMs: { ...powered.powerUpRemainingMs, freeze: 4000 },
      }),
    ).toBe(false)
    expect(
      areGameUiSnapshotsEqual(snapshot, { ...snapshot, stats: { ...snapshot.stats, bombHits: 1 } }),
    ).toBe(false)
    for (const field of ['strokesAttempted', 'successfulStrokes', 'peakStrokeCombo'] as const) {
      expect(
        areGameUiSnapshotsEqual(snapshot, {
          ...snapshot,
          stats: { ...snapshot.stats, [field]: 1 },
        }),
      ).toBe(false)
    }
    expect(areGameUiSnapshotsEqual(snapshot, { ...snapshot, runId: 'another-run' })).toBe(false)
  })
})
