import { expect, test } from 'bun:test'
import { createImpactFeedback } from '../src/game/render/impactFeedback'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createBombEntity } from '../src/game/model/entities'
import type { GamePresentationEvent } from '../src/game/types'

function canvasProbe() {
  const arcs: number[][] = []
  const labels: { text: string; x: number; y: number }[] = []
  const fills: number[][] = []
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    arc: (...args: number[]) => arcs.push(args),
    fillRect: (...args: number[]) => fills.push(args),
    fillText: (text: string, x: number, y: number) => labels.push({ text, x, y }),
    measureText: (text: string) => ({ width: text.length * 10 }),
  } as unknown as CanvasRenderingContext2D
  return { ctx, arcs, labels, fills }
}

const bounds = { x: 720, y: 1280 }
const viewport = { scale: 0.5, offsetX: 0, offsetY: 0 }
const bomb = (id = 1, penalty = 0): GamePresentationEvent => ({
  id,
  runId: 'run',
  atMs: 10,
  type: 'bomb-hit',
  entityId: 'entity_1',
  position: { x: 360, y: 640 },
  penalty,
})
const combo = (id: number, strokeId = 1): GamePresentationEvent => ({
  id,
  runId: 'run',
  atMs: 10,
  type: 'stroke-combo',
  strokeId,
  fruitCount: id + 2,
  bonus: 15,
  position: { x: 360, y: 640 },
})

test('bomb impact is centered, names actual penalties, and expires on presentation time', () => {
  const feedback = createImpactFeedback()
  feedback.consume([bomb(1, 55)], 100, bounds)
  const first = canvasProbe()
  feedback.draw(first.ctx, 100, viewport, bounds, 360, 640, false)
  expect(first.arcs[0].slice(0, 2)).toEqual([180, 320])
  expect(first.labels[0].text).toBe('BOMB · −55')
  expect(first.fills).toContainEqual([0, 0, 360, 640])
  const after = canvasProbe()
  feedback.draw(after.ctx, 800, viewport, bounds, 360, 640, false)
  expect(after.arcs).toHaveLength(0)
  expect(after.labels).toHaveLength(0)
  expect(after.fills).toHaveLength(0)
  // Re-delivery cannot restart an expired impact/flash.
  feedback.consume([bomb(1, 55)], 801, bounds)
  feedback.draw(after.ctx, 801, viewport, bounds, 360, 640, false)
  expect(after.labels).toHaveLength(0)
})

test('reduced motion retains a static zero-score bomb cue without rings or screen flash', () => {
  const feedback = createImpactFeedback()
  feedback.consume([bomb()], 100, bounds)
  for (const now of [100, 400]) {
    const probe = canvasProbe()
    feedback.draw(probe.ctx, now, viewport, bounds, 360, 640, true)
    expect(probe.arcs).toHaveLength(0)
    expect(probe.fills).toHaveLength(1) // Only the small contrast backing.
    expect(probe.labels).toEqual([{ text: 'BOMB HIT', x: 180, y: 278 }])
  }
})

test('growing stroke combos coalesce and catch-up effects have a fixed work budget', () => {
  const feedback = createImpactFeedback()
  feedback.consume([combo(1), combo(2), combo(3)], 100, bounds)
  const single = canvasProbe()
  feedback.draw(single.ctx, 100, viewport, bounds, 360, 640, false)
  expect(single.arcs).toHaveLength(2)
  feedback.consume(
    Array.from({ length: 40 }, (_, i) => combo(i + 4, i + 2)),
    100,
    bounds,
  )
  const bounded = canvasProbe()
  feedback.draw(bounded.ctx, 100, viewport, bounds, 360, 640, false)
  expect(bounded.arcs).toHaveLength(24)
  const reduced = canvasProbe()
  feedback.draw(reduced.ctx, 100, viewport, bounds, 360, 640, true)
  expect(reduced.arcs).toHaveLength(0)
  const expired = canvasProbe()
  feedback.draw(expired.ctx, 460, viewport, bounds, 360, 640, false)
  expect(expired.arcs).toHaveLength(0)
})

test('rotation preserves normalized impact position and clamps labels inside the screen', () => {
  const feedback = createImpactFeedback()
  feedback.consume([bomb()], 100, bounds)
  const rotated = canvasProbe()
  feedback.draw(rotated.ctx, 100, viewport, { x: 1280, y: 720 }, 640, 360, false)
  expect(rotated.arcs[0].slice(0, 2)).toEqual([320, 180])
  feedback.consume([{ ...bomb(2, 55), position: { x: 0, y: 0 } }], 100, bounds)
  const edge = canvasProbe()
  feedback.draw(edge.ctx, 100, viewport, bounds, 320, 568, true)
  expect(edge.labels[0].x).toBeGreaterThan(8)
  expect(edge.labels[0].y).toBe(20)
})

test('reset clears old impacts and permits a fresh run with reused event IDs', () => {
  const feedback = createImpactFeedback()
  feedback.consume([bomb()], 100, bounds)
  feedback.reset()
  const cleared = canvasProbe()
  feedback.draw(cleared.ctx, 101, viewport, bounds, 360, 640, false)
  expect(cleared.fills).toHaveLength(0)
  feedback.consume([combo(1)], 102, bounds)
  feedback.draw(cleared.ctx, 102, viewport, bounds, 360, 640, false)
  expect(cleared.arcs).toHaveLength(2)
})

test.each(['classic', 'arcade'] as const)(
  '%s bomb feedback does not advance gameplay, timers or random streams',
  (mode) => {
    const engine = createGameEngine({ seed: 7, mode })
    engine.start()
    const state = engine.getState()
    state.world.spawn.nextWaveAtMs = Infinity
    state.score.current = 100
    const entity = createBombEntity({
      position: { x: 360, y: 300 },
      velocity: { x: 0, y: 0 },
      radius: 30,
      color: '#000',
      rotationRad: 0,
      angularVelocityRadPerS: 0,
    })
    state.world.entities[entity.id] = entity
    let events: readonly GamePresentationEvent[] = []
    engine.subscribeEvents((batch) => {
      events = batch
    })
    engine.setInputTrails([
      {
        pointerId: 1,
        points: [
          { x: 300, y: 300, tMs: 0 },
          { x: 420, y: 300, tMs: 10 },
        ],
      },
    ])
    engine.advanceBy(100)
    expect(state.phase).toBe(mode === 'classic' ? 'game-over' : 'running')
    const before = JSON.stringify(state)
    const eventSnapshot = JSON.stringify(events)
    const feedback = createImpactFeedback()
    feedback.consume(events, 100, state.world.bounds)
    for (const reduced of [false, true]) {
      const first = canvasProbe()
      feedback.draw(first.ctx, 100, viewport, state.world.bounds, 360, 640, reduced)
      expect(first.labels[0].text).toBe(mode === 'classic' ? 'BOMB HIT' : 'BOMB · −50')
    }
    const expired = canvasProbe()
    feedback.draw(expired.ctx, 800, viewport, state.world.bounds, 360, 640, false)
    expect(expired.labels).toHaveLength(0)
    expect(JSON.stringify(state)).toBe(before)
    expect(JSON.stringify(events)).toBe(eventSnapshot)
  },
)
