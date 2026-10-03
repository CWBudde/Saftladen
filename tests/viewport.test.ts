import { expect, test } from 'bun:test'
import { canvasPointToWorld, createViewportTransform, getAdaptiveWorldBounds, worldPointToCanvas } from '../src/game/core/viewport'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createFruitEntity } from '../src/game/model/entities'
import { stepDespawnSystem } from '../src/game/systems/despawnSystem'

const viewports = [
  { widthCssPx: 1280, heightCssPx: 720 },
  { widthCssPx: 320, heightCssPx: 568 },
  { widthCssPx: 390, heightCssPx: 844 },
  { widthCssPx: 844, heightCssPx: 390 },
]

test('adaptive worlds fill portrait and landscape with a uniform inverse transform', () => {
  for (const metrics of viewports) {
    const bounds = getAdaptiveWorldBounds(metrics)
    const viewport = createViewportTransform(metrics, bounds)
    expect(Math.min(bounds.x, bounds.y)).toBeCloseTo(720)
    expect(viewport.offsetX).toBeCloseTo(0)
    expect(viewport.offsetY).toBeCloseTo(0)
    expect(bounds.x * viewport.scale).toBeCloseTo(metrics.widthCssPx)
    expect(bounds.y * viewport.scale).toBeCloseTo(metrics.heightCssPx)
    const center = { x: bounds.x * 0.63, y: bounds.y * 0.42 }
    const canvas = worldPointToCanvas(center, viewport)
    const roundtrip = canvasPointToWorld(canvas, viewport)
    expect(roundtrip.x).toBeCloseTo(center.x)
    expect(roundtrip.y).toBeCloseTo(center.y)
    // Equal-radius horizontal and vertical contacts have equal CSS distances.
    const horizontal = worldPointToCanvas({ x: center.x + 30, y: center.y }, viewport)
    const vertical = worldPointToCanvas({ x: center.x, y: center.y + 30 }, viewport)
    expect(horizontal.x - canvas.x).toBeCloseTo(vertical.y - canvas.y)
    expect(30 * viewport.scale).toBeGreaterThanOrEqual(13)
  }
})

test('contain fallback centers a fixed world and uses the same inverse for pointer contacts', () => {
  const viewport = createViewportTransform({ widthCssPx: 320, heightCssPx: 568 }, { x: 1280, y: 720 })
  expect(viewport.scale).toBe(0.25)
  expect(viewport.offsetY).toBe(194)
  expect(worldPointToCanvas({ x: 640, y: 360 }, viewport)).toEqual({ x: 160, y: 284 })
  expect(canvasPointToWorld({ x: 160, y: 284 }, viewport)).toEqual({ x: 640, y: 360 })
})

function addFruit(engine: ReturnType<typeof createGameEngine>, position: { x: number; y: number }, velocity = { x: 0, y: 0 }) {
  const fruit = createFruitEntity({
    fruitType: 'apple', color: '#ef4444', position, velocity,
    radius: 30, rotationRad: 0, angularVelocityRadPerS: 0,
  })
  engine.getState().world.entities[fruit.id] = fruit
  return fruit
}

test('the same visible stroke hits a fruit through the real engine in either orientation', () => {
  for (const metrics of viewports) {
    const engine = createGameEngine({ seed: 1, effectsEnabled: false })
    const bounds = getAdaptiveWorldBounds(metrics)
    engine.setWorldBounds(bounds)
    engine.start()
    engine.getState().world.spawn.nextWaveAtMs = Infinity
    const fruit = addFruit(engine, { x: bounds.x * 0.5, y: bounds.y * 0.5 })
    const viewport = createViewportTransform(metrics, bounds)
    const canvas = worldPointToCanvas(fruit.position, viewport)
    engine.setInputTrails([{ pointerId: 1, points: [-60, 60].map((offset, index) => ({
      ...canvasPointToWorld({ x: canvas.x + offset * viewport.scale, y: canvas.y }, viewport), tMs: index * 10,
    })) }])
    engine.stepOnce()
    expect(engine.getState().run.stats.fruitSliced).toBe(1)
    expect(engine.getState().score.current).toBe(10)
  }
})

test('resize preserves live fruit, below-screen launch margins, pending times and run state', () => {
  const engine = createGameEngine({ seed: 1 })
  engine.start()
  const world = engine.getState().world
  const visible = addFruit(engine, { x: 640, y: 360 }, { x: 120, y: -500 })
  const entering = addFruit(engine, { x: 600, y: 775 }, { x: 10, y: -700 })
  // Still inside the miss margin despite falling below the canvas.
  const leaving = addFruit(engine, { x: 700, y: 780 }, { x: 0, y: 100 })
  const pending = createFruitEntity({
    fruitType: 'orange', color: '#fb923c', position: { x: 640, y: 775 },
    velocity: { x: 20, y: -700 }, radius: 30, rotationRad: 0, angularVelocityRadPerS: 0,
  })
  world.spawn.pending.push({ spawnAtMs: 200, entity: pending })
  const runId = engine.getState().run.id
  const stats = { ...engine.getState().run.stats }
  engine.setWorldBounds({ x: 720, y: 1560 })
  expect(visible.position).toEqual({ x: 360, y: 780 })
  expect(visible.radius).toBe(30)
  expect(visible.velocity.y).toBeCloseTo(-500 * Math.sqrt(1560 / 720))
  expect(entering.position.y).toBe(1615)
  expect(pending.position.y).toBe(1615)
  expect(leaving.position.y).toBe(1620)
  expect(world.spawn.pending[0].spawnAtMs).toBe(200)
  expect(stepDespawnSystem(engine.getState() as Parameters<typeof stepDespawnSystem>[0]).missedFruits).toBe(0)
  expect(engine.getState().run.id).toBe(runId)
  expect(engine.getState().run.stats).toEqual(stats)
  engine.setWorldBounds({ x: 1280, y: 720 })
  expect(visible.position).toEqual({ x: 640, y: 360 })
  expect(visible.velocity.x).toBeCloseTo(120)
  expect(visible.velocity.y).toBeCloseTo(-500)
  expect(pending.position.y).toBe(775)
  expect(leaving.position.y).toBe(780)
})

test('viewport bounds survive new runs, reset and mode changes; invalid requests are ignored', () => {
  const engine = createGameEngine({ seed: 1 })
  const bounds = { x: 720, y: 1560 }
  engine.setWorldBounds(bounds)
  bounds.y = 9999
  const expected = { x: 720, y: 1560 }
  engine.start()
  expect(engine.getState().world.bounds).toEqual(expected)
  engine.markGameOver()
  engine.start()
  expect(engine.getState().world.bounds).toEqual(expected)
  engine.reset()
  engine.setMode('arcade')
  expect(engine.getState().world.bounds).toEqual(expected)
  for (const invalid of [{ x: 0, y: 720 }, { x: 720, y: NaN }, { x: Infinity, y: 720 }]) engine.setWorldBounds(invalid)
  expect(engine.getState().world.bounds).toEqual(expected)
})

test('resizing discards queued strokes captured in the old coordinate system', () => {
  const engine = createGameEngine({ seed: 1 })
  engine.start()
  engine.getState().world.spawn.nextWaveAtMs = Infinity
  const fruit = addFruit(engine, { x: 640, y: 360 })
  engine.setInputTrails([{ pointerId: 1, points: [{ x: 300, y: 780, tMs: 0 }, { x: 420, y: 780, tMs: 10 }] }])
  engine.setWorldBounds({ x: 720, y: 1560 })
  engine.stepOnce()
  expect(engine.getState().world.entities[fruit.id]).toBeDefined()
  expect(engine.getState().score.current).toBe(0)
})
