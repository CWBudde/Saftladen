import { createDecalEntity, createFruitHalfEntity, createParticleEntity } from '../model'
import type { FruitEntity, GameState, SliceEvent } from '../types'
import type { SystemContext } from './systemContext'
import {
  BASE_FRUIT_POINTS,
  JUICE_PARTICLE_COUNT,
  JUICE_SPLAT_DECAL_COUNT,
  SCORE_FEEDBACK_LIFETIME_MS,
} from './constants'
import { activatePowerUp, type ModeSystemModifiers } from './modeSystem'

type RandomSource = {
  nextFloat: () => number
  nextInt: (minInclusive: number, maxInclusive: number) => number
}

function randomRange(random: RandomSource, min: number, max: number): number {
  return min + (max - min) * random.nextFloat()
}

function spawnFruitHalves(state: GameState, fruit: FruitEntity, event: SliceEvent, random: RandomSource, context?: SystemContext): void {
  const normal = { x: -event.direction.y, y: event.direction.x }
  const cutAngleRad = Math.atan2(normal.y, normal.x) - fruit.rotationRad
  const separation = randomRange(random, 140, 220)
  const lift = randomRange(random, 40, 100)
  const leftHalf = createFruitHalfEntity({
    id: context?.nextCosmeticId(),
    cutAngleRad,
    fruitType: fruit.fruitType,
    color: fruit.color,
    half: 'left',
    sourceFruitId: fruit.id,
    position: { ...fruit.position },
    velocity: {
      x: fruit.velocity.x - normal.x * separation,
      y: fruit.velocity.y - normal.y * separation - lift,
    },
    rotationRad: fruit.rotationRad,
    angularVelocityRadPerS: fruit.angularVelocityRadPerS - randomRange(random, 0.6, 1.6),
    radius: fruit.radius * 0.72,
    lifetimeMs: randomRange(random, 650, 950),
  })

  const rightHalf = createFruitHalfEntity({
    id: context?.nextCosmeticId(),
    cutAngleRad,
    fruitType: fruit.fruitType,
    color: fruit.color,
    half: 'right',
    sourceFruitId: fruit.id,
    position: { ...fruit.position },
    velocity: {
      x: fruit.velocity.x + normal.x * separation,
      y: fruit.velocity.y + normal.y * separation - lift,
    },
    rotationRad: fruit.rotationRad,
    angularVelocityRadPerS: fruit.angularVelocityRadPerS + randomRange(random, 0.6, 1.6),
    radius: fruit.radius * 0.72,
    lifetimeMs: randomRange(random, 650, 950),
  })

  state.world.entities[leftHalf.id] = leftHalf
  state.world.entities[rightHalf.id] = rightHalf
}

function spawnJuiceParticles(
  state: GameState,
  source: FruitEntity,
  hitPosition: { x: number; y: number },
  random: RandomSource,
  context?: SystemContext,
  event?: SliceEvent,
): void {
  for (let i = 0; i < JUICE_PARTICLE_COUNT; i += 1) {
    const normalAngle = event ? Math.atan2(event.direction.y, event.direction.x) + Math.PI / 2 : 0
    const angle = normalAngle + (i % 2 === 0 ? 0 : Math.PI) + randomRange(random, -0.65, 0.65)
    const speed = randomRange(random, 120, 440)

    const particle = createParticleEntity({
      id: context?.nextCosmeticId(),
      color: source.color,
      position: { ...hitPosition },
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - randomRange(random, 40, 140),
      },
      rotationRad: randomRange(random, 0, Math.PI * 2),
      angularVelocityRadPerS: randomRange(random, -8, 8),
      radius: randomRange(random, 2, 5),
      lifetimeMs: randomRange(random, 260, 620),
    })

    state.world.entities[particle.id] = particle
  }
}

function spawnJuiceSplats(
  state: GameState,
  source: FruitEntity,
  hitPosition: { x: number; y: number },
  random: RandomSource,
  context?: SystemContext,
): void {
  for (let i = 0; i < JUICE_SPLAT_DECAL_COUNT; i += 1) {
    const offsetX = randomRange(random, -32, 32)
    const offsetY = randomRange(random, -20, 20)
    const radius = randomRange(random, source.radius * 0.45, source.radius * 0.8)

    const decal = createDecalEntity({
      id: context?.nextCosmeticId(),
      color: source.color,
      position: {
        x: hitPosition.x + offsetX,
        y: hitPosition.y + offsetY,
      },
      velocity: {
        x: 0,
        y: 0,
      },
      rotationRad: randomRange(random, 0, Math.PI * 2),
      angularVelocityRadPerS: randomRange(random, -0.9, 0.9),
      radius,
      maxRadius: radius * randomRange(random, 1.2, 1.8),
      lifetimeMs: randomRange(random, 380, 760),
    })

    state.world.entities[decal.id] = decal
  }
}

export function resolveSliceEvents(
  state: GameState,
  random: RandomSource,
  modifiers: ModeSystemModifiers,
  context?: SystemContext,
): { bombHit: boolean; fruitSlices: number } {
  let bombHit = false
  let fruitSlices = 0

  while (state.world.sliceEvents.length > 0) {
    const event = state.world.sliceEvents.shift()
    if (!event) {
      break
    }

    const entity = state.world.entities[event.entityId]
    if (!entity) {
      continue
    }

    if (entity.kind === 'bomb') {
      const penalty = state.mode === 'arcade' ? Math.floor(state.score.current / 2) : 0
      state.run.stats.bombHits += 1
      context?.events.push({ type: 'bomb-hit', atMs: state.world.elapsedMs, entityId: entity.id, position: { ...event.hitPosition }, penalty })
      delete state.world.entities[entity.id]
      if (state.mode === 'arcade') {
        state.score.current = Math.max(0, state.score.current - penalty)
        state.score.combo = 0
        state.score.lastSliceAtMs = state.world.elapsedMs
        state.world.lastBombHitAtMs = state.world.elapsedMs
        state.world.scoreFeedbackEvents.push({
          id: state.world.nextScoreFeedbackId,
          amount: -penalty,
          combo: 1,
          position: { ...event.hitPosition },
          createdAtMs: state.world.elapsedMs,
          lifetimeMs: SCORE_FEEDBACK_LIFETIME_MS,
        })
        state.world.nextScoreFeedbackId += 1
      } else {
        bombHit = true
        // A Classic bomb ends this run immediately; later hits in the same batch cannot score.
        state.world.sliceEvents.length = 0
        break
      }
      continue
    }

    if (entity.kind === 'power-up') {
      delete state.world.entities[entity.id]
      activatePowerUp(state, entity.powerUpType)
      if (state.mode === 'arcade') {
        const timers = state.modeState.arcade.powerUpTimers
        const durationMs = entity.powerUpType === 'freeze' ? timers.freezeMs : entity.powerUpType === 'frenzy' ? timers.frenzyMs : timers.doublePointsMs
        context?.events.push({ type: 'power-up-activated', atMs: state.world.elapsedMs, powerUp: entity.powerUpType, position: { ...event.hitPosition }, durationMs })
      }
      const bonusPoints = Math.round(BASE_FRUIT_POINTS * 1.5 * modifiers.scoreMultiplier)
      state.score.current += bonusPoints
      state.world.scoreFeedbackEvents.push({
        id: state.world.nextScoreFeedbackId,
        amount: bonusPoints,
        combo: Math.max(1, state.score.combo),
        position: { ...event.hitPosition },
        createdAtMs: state.world.elapsedMs,
        lifetimeMs: SCORE_FEEDBACK_LIFETIME_MS,
      })
      state.world.nextScoreFeedbackId += 1
      continue
    }

    if (entity.kind !== 'fruit') {
      continue
    }

    const withinComboWindow =
      state.score.lastSliceAtMs !== null &&
      state.world.elapsedMs - state.score.lastSliceAtMs <= state.score.comboWindowMs
    const nextCombo = withinComboWindow ? state.score.combo + 1 : 1
    const points = BASE_FRUIT_POINTS * nextCombo * modifiers.scoreMultiplier

    state.score.combo = nextCombo
    state.score.lastSliceAtMs = state.world.elapsedMs
    delete state.world.entities[entity.id]
    state.score.current += points
    fruitSlices += 1
    state.run.stats.fruitSliced += 1
    state.run.stats.peakCombo = Math.max(state.run.stats.peakCombo, nextCombo)
    context?.events.push({ type: 'fruit-slice', atMs: state.world.elapsedMs, entityId: entity.id, fruitType: entity.fruitType, position: { ...event.hitPosition }, direction: { ...event.direction }, points, combo: nextCombo })

    state.world.scoreFeedbackEvents.push({
      id: state.world.nextScoreFeedbackId,
      amount: points,
      combo: nextCombo,
      position: { ...event.hitPosition },
      createdAtMs: state.world.elapsedMs,
      lifetimeMs: SCORE_FEEDBACK_LIFETIME_MS,
    })
    state.world.nextScoreFeedbackId += 1

    if (context?.effectsEnabled !== false) {
      spawnFruitHalves(state, entity, event, random, context)
      spawnJuiceParticles(state, entity, event.hitPosition, random, context, event)
      spawnJuiceSplats(state, entity, event.hitPosition, random, context)
    }
  }

  const comboExpired =
    state.score.lastSliceAtMs !== null && state.world.elapsedMs - state.score.lastSliceAtMs > state.score.comboWindowMs
  if (comboExpired && fruitSlices === 0) {
    state.score.combo = 0
  }

  return {
    bombHit,
    fruitSlices,
  }
}
