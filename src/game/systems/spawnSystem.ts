import { createBombEntity, createFruitEntity, createPowerUpEntity } from '../model'
import type { FruitType, GameState, PowerUpType, Vec2 } from '../types'
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
  startY: number,
  waveIndex: number,
  waveSize: number,
): Vec2 {
  const spread = (waveIndex - (waveSize - 1) / 2) * 36
  const vx = randomRange(random, -220, 220) + spread
  const targetApexY = randomRange(random, worldBounds.y * 0.24, worldBounds.y * 0.5)
  const requiredVyAbs = Math.sqrt(Math.max(0, 2 * WORLD_GRAVITY_PX_PER_S2 * (startY - targetApexY)))
  const vyAbs = clamp(requiredVyAbs + randomRange(random, 25, 170), 760, 1500)

  return { x: vx, y: -vyAbs }
}

export function stepSpawnSystem(state: GameState, random: RandomSource, modifiers: ModeSystemModifiers): void {
  const { world } = state
  if (world.elapsedMs < world.spawn.nextWaveAtMs) {
    return
  }

  const difficulty = state.mode === 'arcade' ? getArcadeProgress(state) : getDifficultyProgress(world.elapsedMs)
  const minWaveSize = state.mode === 'arcade' ? 2 : 1
  const maxWaveSize = state.mode === 'arcade' ? clamp(3 + Math.floor(difficulty * 3), 3, 7) : clamp(1 + Math.floor(difficulty * 5), 1, 6)
  const waveSize = random.nextInt(minWaveSize, maxWaveSize)

  let bombChance = state.mode === 'arcade' ? lerp(0.04, 0.12, difficulty) : lerp(0.08, 0.2, difficulty)
  if (modifiers.suppressBombSpawns) {
    bombChance = 0
  }
  const powerUpStartMs = state.mode === 'arcade' ? 8000 : 20000
  const powerUpChance = world.elapsedMs >= powerUpStartMs ? lerp(0.05, 0.12, difficulty) : 0

  for (let i = 0; i < waveSize; i += 1) {
    const roll = random.nextFloat()
    const radius = randomRange(random, 22, 40)

    const baseX = (world.bounds.x * (i + 1)) / (waveSize + 1)
    const x = clamp(baseX + randomRange(random, -80, 80), radius + 12, world.bounds.x - radius - 12)
    const startY = world.bounds.y + radius + randomRange(random, 6, 28)
    const velocity = createLaunchVelocity(random, world.bounds, startY, i, waveSize)

    if (roll < powerUpChance) {
      const powerUpPick = POWER_UP_PALETTE[random.nextInt(0, POWER_UP_PALETTE.length - 1)]
      const powerUp = createPowerUpEntity({
        powerUpType: powerUpPick.powerUpType,
        color: powerUpPick.color,
        position: { x, y: startY },
        velocity,
        rotationRad: randomRange(random, 0, Math.PI * 2),
        angularVelocityRadPerS: randomRange(random, -2.4, 2.4),
        radius,
      })
      world.entities[powerUp.id] = powerUp
      continue
    }

    if (roll < powerUpChance + bombChance) {
      const bomb = createBombEntity({
        color: '#111827',
        position: { x, y: startY },
        velocity,
        rotationRad: randomRange(random, 0, Math.PI * 2),
        angularVelocityRadPerS: randomRange(random, -3, 3),
        radius: randomRange(random, 24, 34),
      })
      world.entities[bomb.id] = bomb
      continue
    }

    const fruitPick = FRUIT_PALETTE[random.nextInt(0, FRUIT_PALETTE.length - 1)]
    const fruit = createFruitEntity({
      fruitType: fruitPick.fruitType,
      color: fruitPick.color,
      position: { x, y: startY },
      velocity,
      rotationRad: randomRange(random, 0, Math.PI * 2),
      angularVelocityRadPerS: randomRange(random, -3.8, 3.8),
      radius,
    })
    world.entities[fruit.id] = fruit
  }

  world.spawn.wavesSpawned += 1
  const intervalBaseMs = state.mode === 'arcade' ? lerp(980, 360, difficulty) : lerp(1300, 520, difficulty)
  const intervalWithJitterMs = intervalBaseMs * randomRange(random, 0.82, 1.24)
  const adjustedIntervalMs = intervalWithJitterMs / Math.max(0.35, modifiers.spawnRateScale)
  world.spawn.nextWaveAtMs = world.elapsedMs + clamp(adjustedIntervalMs, 200, 1600)
}
