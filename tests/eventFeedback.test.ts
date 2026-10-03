import { expect, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createBombEntity, createFruitEntity, createPowerUpEntity } from '../src/game/model/entities'
import { eventAnnouncement, eventSounds } from '../src/game/ui/eventFeedback'
import type { GamePresentationEvent } from '../src/game/types'

test('audio preserves cuts even when a bomb makes the batch score fall', () => {
  const engine = createGameEngine({ seed: 1, mode: 'arcade' })
  engine.start()
  const state = engine.getState()
  state.world.spawn.nextWaveAtMs = Infinity
  state.score.current = 100
  const motion = {
    position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 },
    rotationRad: 0, angularVelocityRadPerS: 0, radius: 30,
  }
  const fruit = createFruitEntity({ ...motion, fruitType: 'apple', color: '#f44' })
  const bomb = createBombEntity({ ...motion, position: { x: 600, y: 300 }, color: '#000' })
  state.world.entities[fruit.id] = fruit
  state.world.entities[bomb.id] = bomb
  let events: readonly GamePresentationEvent[] = []
  engine.subscribeEvents((batch) => { events = batch })
  engine.setInputTrails([{ pointerId: 1, points: [{ x: 450, y: 300, tMs: 0 }, { x: 650, y: 300, tMs: 10 }] }])
  engine.advanceBy(100)
  expect(state.score.current).toBeLessThan(100)
  expect(eventSounds(events)).toEqual([{ name: 'slice' }, { name: 'bomb' }])
  expect(eventAnnouncement(events)).toContain('Bomb hit.')
})

test('pickup score triggers its activation cue without a fruit cut cue', () => {
  const engine = createGameEngine({ seed: 1, mode: 'arcade' })
  engine.start()
  const state = engine.getState()
  state.world.spawn.nextWaveAtMs = Infinity
  const powerUp = createPowerUpEntity({
    powerUpType: 'freeze', color: '#0ff', position: { x: 500, y: 300 },
    velocity: { x: 0, y: 0 }, rotationRad: 0, angularVelocityRadPerS: 0, radius: 30,
  })
  state.world.entities[powerUp.id] = powerUp
  let events: readonly GamePresentationEvent[] = []
  engine.subscribeEvents((batch) => { events = batch })
  engine.setInputTrails([{ pointerId: 1, points: [{ x: 450, y: 300, tMs: 0 }, { x: 550, y: 300, tMs: 10 }] }])
  engine.stepOnce()
  expect(state.score.current).toBeGreaterThan(0)
  expect(eventSounds(events)).toEqual([{ name: 'power-up' }])
  expect(eventAnnouncement(events)).toBe('freeze activated.')
})

test('combo audio and announcements represent a stroke bonus, while a timed streak remains a slice', () => {
  const events: GamePresentationEvent[] = [
    { id: 1, runId: 'run', type: 'fruit-slice', atMs: 100, entityId: 'entity_1',
      fruitType: 'apple', position: { x: 10, y: 20 }, direction: { x: 1, y: 0 }, points: 10, combo: 5 },
    { id: 2, runId: 'run', type: 'stroke-combo', atMs: 100, strokeId: 1,
      fruitCount: 3, bonus: 15, position: { x: 10, y: 20 } },
  ]
  expect(eventSounds(events)).toEqual([{ name: 'slice' }, { name: 'combo', rate: 1 }])
  expect(eventAnnouncement(events)).toBe('Stroke combo. 3 fruit, 15 bonus points.')
})

test('ordinary cuts and empty timer batches leave the live announcement unchanged', () => {
  expect(eventAnnouncement([])).toBeNull()
  expect(eventAnnouncement([{ id: 1, runId: 'run', type: 'fruit-slice', atMs: 100,
    entityId: 'fruit', fruitType: 'apple', position: { x: 10, y: 20 },
    direction: { x: 1, y: 0 }, points: 10, combo: 1 }])).toBeNull()
})
