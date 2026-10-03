import { describe, expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createTrailTracker } from '../src/game/input/trailTracker'
import { createBombEntity, createFruitEntity, createPowerUpEntity } from '../src/game/model'
import type { GamePresentationEvent, GameState, ScoringConfig, SliceTrail } from '../src/game/types'

const motion = { velocity: { x: 0, y: 0 }, rotationRad: 0, angularVelocityRadPerS: 0, radius: 12 }
function setup(mode: 'classic' | 'arcade' | 'zen' = 'zen', scoring?: Partial<ScoringConfig>) {
  const engine = createGameEngine({ mode, seed: 7, fixedDtMs: 1, effectsEnabled: false, scoring })
  const events: GamePresentationEvent[] = []
  engine.subscribeEvents((batch) => events.push(...batch))
  engine.start()
  const state = engine.getState() as GameState
  state.world.spawn.nextWaveAtMs = Infinity
  const fruit = (x: number, y = 100) => {
    const entity = createFruitEntity({ ...motion, fruitType: 'apple', color: '#f00', position: { x, y } })
    state.world.entities[entity.id] = entity
    return entity
  }
  const consume = (trails: SliceTrail[]) => { engine.setInputTrails(trails); engine.stepOnce() }
  return { engine, state, events, fruit, consume }
}
const swipe = (strokeId?: number, ended = true, y = 100): SliceTrail => ({
  pointerId: 1, strokeId, ended, points: [{ x: 0, y, tMs: 0 }, { x: 900, y, tMs: 20 }],
})

describe('same-stroke bonuses and capped timed streaks', () => {
  test('three fruit give a gesture bonus; three separate swipes only build the streak', () => {
    const together = setup()
    for (const x of [100, 200, 300]) together.fruit(x)
    together.consume([swipe(1)])
    expect(together.state.score.current).toBe(45)
    expect(together.state.run.stats).toMatchObject({ fruitSliced: 3, strokesAttempted: 1, successfulStrokes: 1, peakStrokeCombo: 3, peakCombo: 3 })
    expect(together.events.filter((event) => event.type === 'stroke-combo')).toHaveLength(1)
    expect(together.state.score.strokes).toEqual({})

    const apart = setup()
    for (let id = 1; id <= 3; id++) { apart.fruit(100); apart.consume([swipe(id)]) }
    expect(apart.state.score.current).toBe(30)
    expect(apart.state.score.combo).toBe(3)
    expect(apart.state.run.stats.peakStrokeCombo).toBe(1)
    expect(apart.events.some((event) => event.type === 'stroke-combo')).toBe(false)
  })

  test('release after an earlier drain closes the gesture after cuts spanning fixed steps', () => {
    const { state, fruit, consume } = setup()
    const tracker = createTrailTracker()
    tracker.beginTrail(9, { x: 0, y: 100, tMs: 0 })
    for (let index = 1; index <= 3; index++) {
      fruit(index * 100 - 50)
      tracker.appendPoint(9, { x: index * 100, y: 100, tMs: index * 10 })
      consume(tracker.drainSliceTrails(index * 10))
    }
    expect(state.score.current).toBe(45)
    expect(Object.keys(state.score.strokes)).toHaveLength(1)
    tracker.endTrail(9)
    const released = tracker.drainSliceTrails(40)
    expect(released).toHaveLength(1)
    expect(released[0]).toMatchObject({ ended: true, points: [] })
    consume(released)
    expect(state.score.strokes).toEqual({})
    expect(state.run.stats.strokesAttempted).toBe(1)
    expect(state.score.strokeCombo).toBe(3)
  })

  test('reused pointer IDs and simultaneous pointers cannot combine separate gestures', () => {
    const { state, fruit, consume } = setup()
    const tracker = createTrailTracker()
    for (let index = 0; index < 3; index++) {
      fruit(100, 100 + index * 100)
      tracker.beginTrail(1, { x: 0, y: 100 + index * 100, tMs: index * 20 })
      tracker.endTrail(1, { x: 200, y: 100 + index * 100, tMs: index * 20 + 10 })
    }
    const trails = tracker.drainSliceTrails(60)
    expect(new Set(trails.map((trail) => trail.strokeId)).size).toBe(3)
    consume(trails)
    expect(state.score.current).toBe(30)
    expect(state.run.stats).toMatchObject({ strokesAttempted: 3, successfulStrokes: 3, peakStrokeCombo: 1 })
    fruit(100, 500); fruit(300, 600)
    consume([swipe(40, true, 500), { ...swipe(41, true, 600), pointerId: 2 }])
    expect(state.run.stats.peakStrokeCombo).toBe(1)
  })

  test('timed streak multiplier starts on the sixth fruit and caps at two', () => {
    const { state, fruit, consume, engine } = setup()
    const amounts: number[] = []
    for (let index = 1; index <= 30; index++) {
      fruit(100)
      const before = state.score.current
      consume([swipe(index)])
      amounts.push(state.score.current - before)
    }
    expect(amounts.slice(0, 6)).toEqual([10, 10, 10, 10, 10, 13])
    expect(amounts.slice(20)).toEqual(Array(10).fill(20))
    expect(state.score.streakMultiplier).toBe(2)
    expect(state.run.stats.peakCombo).toBe(30)
    expect(state.run.stats.peakStrokeCombo).toBe(1)
    engine.stepOnce(321)
    expect(state.score.combo).toBe(0)
    expect(state.score.streakMultiplier).toBe(1)
    fruit(100); consume([swipe(31)])
    expect(state.score.combo).toBe(1)
  })

  test('configuration controls bonuses and streak caps without allowing two-fruit combos', () => {
    const { state, fruit, consume } = setup('zen', {
      baseFruitPoints: 20, strokeComboMinimum: 2, strokeComboBonus: 40, strokeComboExtraFruitBonus: 10,
      streakFruitInterval: 1, streakMultiplierStep: 0.5, maxStreakMultiplier: 1.5,
    })
    for (const x of [100, 200, 300, 400]) fruit(x)
    consume([swipe(1)])
    expect(state.score.current).toBe(160) // 20 + 30 + 30 + 30 + 40 + 10.
    expect(state.score.scoring.strokeComboMinimum).toBe(3)
    expect(state.score.streakMultiplier).toBe(1.5)
  })

  test('input and entity enumeration cannot change score or gesture attribution', () => {
    const run = (reverse: boolean) => {
      const { state, fruit, consume, events } = setup()
      const fruits = [fruit(100), fruit(200), fruit(300)]
      if (reverse) state.world.entities = Object.fromEntries(fruits.reverse().map((entity) => [entity.id, entity]))
      const trails = [swipe(3), { ...swipe(4), pointerId: 2 }]
      consume(reverse ? trails.reverse() : trails)
      return { score: state.score.current, stats: state.run.stats, assigned: events.filter((event) => event.type === 'fruit-slice').map((event) => event.strokeId) }
    }
    expect(run(false)).toEqual(run(true))
  })

  test('legacy overlapping input is also independent of array order', () => {
    const run = (reverse: boolean) => {
      const { state, fruit, consume } = setup()
      for (const x of [100, 150, 250, 300]) fruit(x)
      // Matching speed makes the first two fruit simultaneous contacts for both
      // pointers. Ownership changes the bonus unless legacy IDs are normalized.
      const trails = [
        { pointerId: 1, points: [{ x: 0, y: 100, tMs: 0 }, { x: 200, y: 100, tMs: 10 }] },
        { pointerId: 2, points: [{ x: 0, y: 100, tMs: 0 }, { x: 400, y: 100, tMs: 20 }] },
      ]
      consume(reverse ? trails.reverse() : trails)
      return { score: state.score.current, stats: state.run.stats }
    }
    expect(run(false)).toEqual(run(true))
    expect(run(false).score).toBe(60)
  })

  test('invalid scoring overrides stay finite and configuration survives new runs and modes', () => {
    const { engine, state } = setup('zen', { baseFruitPoints: Infinity, strokeComboBonus: -20, streakMultiplierStep: NaN, maxStreakMultiplier: 1e300 })
    expect(state.score.scoring.baseFruitPoints).toBe(10)
    expect(state.score.scoring.strokeComboBonus).toBe(15)
    expect(state.score.scoring.streakMultiplierStep).toBe(0.25)
    expect(state.score.scoring.maxStreakMultiplier).toBe(100)
    engine.reset({ seed: 9 })
    engine.setMode('arcade')
    engine.start()
    expect(engine.getState().score.scoring).toEqual(state.score.scoring)
  })

  test('accuracy counts moving attempts and successful fruit gestures, excluding stationary holds', () => {
    const { state, fruit, consume } = setup()
    consume([swipe(1)]) // Miss.
    fruit(100); consume([swipe(2)])
    consume([{ pointerId: 1, strokeId: 3, ended: true, points: [{ x: 100, y: 100, tMs: 0 }, { x: 100, y: 100, tMs: 10 }] }])
    const tracker = createTrailTracker()
    tracker.beginTrail(2, { x: 0, y: 0, tMs: 0 })
    tracker.endTrail(2)
    consume(tracker.drainSliceTrails(20))
    expect(state.run.stats).toMatchObject({ strokesAttempted: 2, successfulStrokes: 1 })
  })

  test.each(['pause', 'resize', 'cancel'] as const)('%s ends active combo bookkeeping', (reason) => {
    const { state, fruit, consume, engine } = setup()
    fruit(100); consume([swipe(5, false)])
    expect(Object.keys(state.score.strokes)).toHaveLength(1)
    if (reason === 'pause') { engine.pause(); engine.resume() }
    if (reason === 'resize') engine.setWorldBounds({ x: 720, y: 1200 })
    if (reason === 'cancel') engine.clearInputTrails(1)
    expect(state.score.strokes).toEqual({})
    expect(state.score.strokeCombo).toBe(0)
    fruit(100); consume([swipe(6)])
    expect(state.run.stats.peakStrokeCombo).toBe(1)
  })

  test('expired release movement cannot cut, and malformed streams cannot grow active bookkeeping', () => {
    const { state, consume } = setup()
    const tracker = createTrailTracker()
    tracker.beginTrail(1, { x: 0, y: 100, tMs: 0 })
    tracker.endTrail(1, { x: 200, y: 100, tMs: 10 })
    expect(tracker.drainSliceTrails(200)[0].points).toEqual([])
    for (let id = 1; id <= 200; id++) consume([swipe(id, false, 500)])
    expect(Object.keys(state.score.strokes).length).toBeLessThanOrEqual(128)
  })

  test('Double Points affects later ordered fruit and gesture bonuses immediately', () => {
    const { state, fruit, consume, events } = setup('arcade')
    fruit(100); fruit(300); fruit(400)
    const power = createPowerUpEntity({ ...motion, powerUpType: 'double-points', color: '#ff0', position: { x: 200, y: 100 } })
    state.world.entities[power.id] = power
    consume([swipe(1)])
    expect(state.score.current).toBe(110) // 10 + pickup30 + 20 + 20 + bonus30.
    expect(events.filter((event) => event.type === 'fruit-slice').map((event) => event.points)).toEqual([10, 20, 20])
    expect(events.find((event) => event.type === 'stroke-combo')).toMatchObject({ bonus: 30 })
  })

  test('Arcade bomb breaks streak and invalidates the gesture bonus; Classic stops at contact', () => {
    for (const mode of ['arcade', 'classic'] as const) {
      const { state, fruit, consume, events } = setup(mode)
      fruit(100); fruit(300); fruit(400)
      const bomb = createBombEntity({ ...motion, color: '#000', position: { x: 200, y: 100 } })
      // Insert last: physical contact order still wins over entity enumeration.
      state.world.entities[bomb.id] = bomb
      consume([swipe(1)])
      expect(events.some((event) => event.type === 'stroke-combo')).toBe(false)
      if (mode === 'arcade') {
        expect(state.score.current).toBe(25)
        expect(state.score.combo).toBe(2)
      } else {
        expect(state.score.current).toBe(10)
        expect(state.phase).toBe('game-over')
        expect(state.run.stats.fruitSliced).toBe(1)
      }
    }
  })
})
