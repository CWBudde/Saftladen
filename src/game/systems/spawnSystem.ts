import { createBombEntity, createFruitEntity, createPowerUpEntity } from '../model'
import type { FruitType, GameEntity, GameState, PendingSpawnEntry, PowerUpType, Vec2 } from '../types'
import { WORLD_GRAVITY_PX_PER_S2 } from './constants'
import type { ModeSystemModifiers } from './modeSystem'

type RandomSource = {
  nextFloat: () => number
  nextInt: (minInclusive: number, maxInclusive: number) => number
}

const FRUIT_PALETTE: Array<{ fruitType: FruitType; color: string }> = [
  { fruitType: 'apple', color: '#ef4444' },
  { fruitType: 'orange', color: '#fb923c' },
  { fruitType: 'watermelon', color: '#22c55e' },
  { fruitType: 'pineapple', color: '#facc15' },
  { fruitType: 'banana', color: '#fde047' },
  { fruitType: 'starfruit', color: '#eab308' },
]

const POWER_UP_PALETTE: Array<{ powerUpType: PowerUpType; color: string }> = [
  { powerUpType: 'freeze', color: '#60a5fa' },
  { powerUpType: 'frenzy', color: '#f97316' },
  { powerUpType: 'double-points', color: '#a78bfa' },
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function randomRange(random: RandomSource, min: number, max: number): number {
  return min + (max - min) * random.nextFloat()
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t
}

// Box-Muller transform: maps two uniform samples to a standard normal N(0,1).
function gaussianSample(random: RandomSource): number {
  const u1 = Math.max(1e-10, random.nextFloat()) // guard against log(0)
  const u2 = random.nextFloat()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function getDifficultyProgress(elapsedMs: number): number {
  return clamp(elapsedMs / 90000, 0, 1)
}

function getArcadeProgress(state: GameState): number {
  const arcadeState = state.modeState.arcade
  const elapsedMs = arcadeState.roundDurationMs - arcadeState.remainingMs
  if (arcadeState.roundDurationMs <= 0) {
    return 0
  }
  return clamp(elapsedMs / arcadeState.roundDurationMs, 0, 1)
}

function createLaunchVelocity(
  random: RandomSource,
  worldBounds: Vec2,
  startX: number,
  startY: number,
  waveIndex: number,
  waveSize: number,
): Vec2 {
  // Apex between 50 % and 75 % up from the bottom (y=0 is screen top).
  const apexY = randomRange(random, worldBounds.y * 0.25, worldBounds.y * 0.5)
  const vyAbs = Math.sqrt(2 * WORLD_GRAVITY_PX_PER_S2 * (startY - apexY))

  // Approximate symmetric flight time back to the screen bottom.
  const tTotal = (2 * vyAbs) / WORLD_GRAVITY_PX_PER_S2

  // vx bounds that guarantee the entity lands within the screen horizontally.
  const margin = 20
  const vxMin = (margin - startX) / tTotal
  const vxMax = (worldBounds.x - margin - startX) / tTotal

  // Sample a desired vx around the wave-spread bias, then clamp to valid range.
  const spreadBias = (waveIndex - (waveSize - 1) / 2) * 36
  const vx = clamp(randomRange(random, -200, 200) + spreadBias, vxMin, vxMax)

  return { x: vx, y: -vyAbs }
}

// Compact trajectory fingerprint used for within-wave similarity checks.
type WaveTraj = { x: number; spd: number; ang: number; tMs: number }

// Two trajectories are "similar" when ALL four normalised deltas fall below
// the 4 % threshold simultaneously. Rejecting similar pairs prevents the
// player from seeing effectively identical arcs in the same wave.
const SIMILARITY_THRESHOLD = 0.04

function areSimilarTrajectories(a: WaveTraj, b: WaveTraj, boundsX: number, tWindowMs: number): boolean {
  if (Math.abs(a.x - b.x) / boundsX >= SIMILARITY_THRESHOLD) return false
  const spdRef = Math.max(a.spd, b.spd)
  if (spdRef > 0 && Math.abs(a.spd - b.spd) / spdRef >= SIMILARITY_THRESHOLD) return false
  // 4 % of π ≈ 7.2 ° — enough to visually distinguish two arcs.
  if (Math.abs(a.ang - b.ang) >= SIMILARITY_THRESHOLD * Math.PI) return false
  if (tWindowMs > 0 && Math.abs(a.tMs - b.tMs) / tWindowMs >= SIMILARITY_THRESHOLD) return false
  return true
}

export function stepSpawnSystem(state: GameState, random: RandomSource, modifiers: ModeSystemModifiers): void {
  const { world } = state

  // Drain pending entities whose scheduled spawn time has arrived.
  const stillPending: PendingSpawnEntry[] = []
  for (const entry of world.spawn.pending) {
    if (entry.spawnAtMs <= world.elapsedMs) {
      world.entities[entry.entity.id] = entry.entity
    } else {
      stillPending.push(entry)
    }
  }
  world.spawn.pending = stillPending

  if (world.elapsedMs < world.spawn.nextWaveAtMs) {
    return
  }

  const difficulty = state.mode === 'arcade' ? getArcadeProgress(state) : getDifficultyProgress(world.elapsedMs)

  // Wave size cadence: first 3 waves are always solo to ease players in.
  // After that, group size ramps from 1–2 up to the full difficulty-based max
  // over roughly 22 subsequent waves. Bombs and fruits share the same cadence.
  const SOLO_WAVE_COUNT = 3
  const wavesSpawned = world.spawn.wavesSpawned
  let waveSize: number
  if (wavesSpawned < SOLO_WAVE_COUNT) {
    waveSize = 1
  } else {
    const groupProgress = clamp((wavesSpawned - SOLO_WAVE_COUNT) / 22, 0, 1)
    const fullMax = state.mode === 'arcade'
      ? clamp(3 + Math.floor(difficulty * 3), 3, 7)
      : clamp(1 + Math.floor(difficulty * 5), 1, 6)
    const effectiveMax = Math.max(2, Math.round(lerp(2, fullMax, groupProgress)))
    waveSize = random.nextInt(1, effectiveMax)
  }

  let bombChance = state.mode === 'arcade' ? lerp(0.04, 0.12, difficulty) : lerp(0.08, 0.2, difficulty)
  if (modifiers.suppressBombSpawns) {
    bombChance = 0
  }
  const powerUpStartMs = state.mode === 'arcade' ? 8000 : 20000
  const powerUpChance = world.elapsedMs >= powerUpStartMs ? lerp(0.05, 0.12, difficulty) : 0

  // Time window over which entities in this wave are staggered.
  // Solo waves always spawn immediately; each additional slot adds 100 ms.
  const tWindowMs = (waveSize - 1) * 100

  const accepted: WaveTraj[] = []
  const MAX_RETRIES = 5

  for (let i = 0; i < waveSize; i += 1) {
    // Sample trajectory params, retrying up to MAX_RETRIES times when the
    // result would be too similar to an already-accepted trajectory.
    let radius = 30, x = 0, startY = 0, velocity: Vec2 = { x: 0, y: 0 }, offsetMs = 0

    for (let retry = 0; ; retry++) {
      radius = randomRange(random, 22, 40)
      const sigma = world.bounds.x * 0.22
      x = clamp(
        world.bounds.x * 0.5 + gaussianSample(random) * sigma,
        radius + 12,
        world.bounds.x - radius - 12,
      )
      startY = world.bounds.y + radius + randomRange(random, 6, 28)
      velocity = createLaunchVelocity(random, world.bounds, x, startY, i, waveSize)
      offsetMs = tWindowMs > 0 ? randomRange(random, 0, tWindowMs) : 0

      const traj: WaveTraj = {
        x,
        spd: Math.hypot(velocity.x, velocity.y),
        ang: Math.atan2(velocity.y, velocity.x),
        tMs: offsetMs,
      }

      if (retry >= MAX_RETRIES || !accepted.some(a => areSimilarTrajectories(a, traj, world.bounds.x, tWindowMs))) {
        accepted.push(traj)
        break
      }
    }

    // Sample appearance params (don't affect trajectory similarity) once accepted.
    const roll = random.nextFloat()
    const spawnAtMs = world.elapsedMs + offsetMs

    let entity: GameEntity
    if (roll < powerUpChance) {
      const powerUpPick = POWER_UP_PALETTE[random.nextInt(0, POWER_UP_PALETTE.length - 1)]
      entity = createPowerUpEntity({
        powerUpType: powerUpPick.powerUpType,
        color: powerUpPick.color,
        position: { x, y: startY },
        velocity,
        rotationRad: randomRange(random, 0, Math.PI * 2),
        angularVelocityRadPerS: randomRange(random, -2.4, 2.4),
        radius,
      })
    } else if (roll < powerUpChance + bombChance) {
      entity = createBombEntity({
        color: '#111827',
        position: { x, y: startY },
        velocity,
        rotationRad: randomRange(random, 0, Math.PI * 2),
        angularVelocityRadPerS: randomRange(random, -3, 3),
        radius,
      })
    } else {
      const fruitPick = FRUIT_PALETTE[random.nextInt(0, FRUIT_PALETTE.length - 1)]
      entity = createFruitEntity({
        fruitType: fruitPick.fruitType,
        color: fruitPick.color,
        position: { x, y: startY },
        velocity,
        rotationRad: randomRange(random, 0, Math.PI * 2),
        angularVelocityRadPerS: randomRange(random, -3.8, 3.8),
        radius,
      })
    }

    world.spawn.pending.push({ spawnAtMs, entity })
  }

  world.spawn.wavesSpawned += 1
  const intervalBaseMs = state.mode === 'arcade' ? lerp(980, 360, difficulty) : lerp(1300, 520, difficulty)
  const intervalWithJitterMs = intervalBaseMs * randomRange(random, 0.82, 1.24)
  const adjustedIntervalMs = intervalWithJitterMs / Math.max(0.35, modifiers.spawnRateScale)
  world.spawn.nextWaveAtMs = world.elapsedMs + clamp(adjustedIntervalMs, 200, 1600)
}
