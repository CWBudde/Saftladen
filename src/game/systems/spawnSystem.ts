import { createBombEntity, createFruitEntity, createPowerUpEntity } from '../model'
import type { FruitType, GameEntity, GameState, PowerUpType, Vec2 } from '../types'
import { WORLD_GRAVITY_PX_PER_S2 } from './constants'
import type { ModeSystemModifiers } from './modeSystem'
import { getSpawnWavePlan, hasSafeHorizontalClearance } from './spawnDirector'
import type { SystemContext } from './systemContext'

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
const randomRange = (random: RandomSource, min: number, max: number) =>
  min + (max - min) * random.nextFloat()

function launchVelocity(bounds: Vec2, start: Vec2, targetX: number, apexFraction: number): Vec2 {
  const verticalSpeed = Math.sqrt(2 * WORLD_GRAVITY_PX_PER_S2 * (start.y - bounds.y * apexFraction))
  return {
    // Target is the landing position; the apex lies halfway along this motion.
    x: (targetX - start.x) / ((2 * verticalSpeed) / WORLD_GRAVITY_PX_PER_S2),
    y: -verticalSpeed,
  }
}

export function stepSpawnSystem(
  state: GameState,
  random: RandomSource,
  modifiers: ModeSystemModifiers,
  context?: SystemContext,
): void {
  const { world } = state
  // Suppression applies to previously queued bombs too, even if a caller directly
  // restores a saved active Frenzy timer rather than calling activatePowerUp.
  world.spawn.pending = world.spawn.pending.filter(
    (entry) => !(modifiers.suppressBombSpawns && entry.entity.kind === 'bomb'),
  )
  const stillPending = []
  for (const entry of world.spawn.pending) {
    if (entry.spawnAtMs <= world.elapsedMs) world.entities[entry.entity.id] = entry.entity
    else stillPending.push(entry)
  }
  world.spawn.pending = stillPending
  if (world.elapsedMs < world.spawn.nextWaveAtMs) return

  const plan = getSpawnWavePlan(state)
  const wave = world.spawn.wavesSpawned
  const unitScale = Math.min(1, Math.min(world.bounds.x, world.bounds.y) / 720)
  const apexFraction = randomRange(random, 0.32, 0.44)
  const occupied = [
    ...Object.values(world.entities),
    ...world.spawn.pending.map((entry) => entry.entity),
  ]
  const bombs = occupied.filter((entity) => entity.kind === 'bomb')
  const fruitWave: GameEntity[] = []
  const currentFruitCount = occupied.filter((entity) => entity.kind === 'fruit').length
  // Keep authored combo windows intact: defer an entire group when pressure is
  // full, rather than dropping arbitrary slots or building up a spawn backlog.
  const waveSlots = currentFruitCount + plan.fruitCount <= plan.fruitBudget ? plan.fruitCount : 0

  for (let i = 0; i < waveSlots; i++) {
    const radius = randomRange(random, 26, 36) * unitScale
    const slot = plan.fruitCount <= 1 ? 0.5 : i / (plan.fruitCount - 1)
    const fraction =
      plan.pattern === 'opening' || plan.pattern === 'recovery'
        ? 0.5
        : plan.pattern === 'fan'
          ? 0.36 + slot * 0.28
          : plan.pattern === 'alternating'
            ? i % 2 === wave % 2
              ? 0.29 + Math.floor(i / 2) * 0.06
              : 0.71 - Math.floor(i / 2) * 0.06
            : 0.27 + slot * 0.46
    const x = world.bounds.x * fraction
    const position = { x, y: world.bounds.y + radius + 12 * unitScale }
    const targetX =
      plan.pattern === 'fan'
        ? world.bounds.x * (0.27 + slot * 0.46)
        : plan.pattern === 'alternating'
          ? world.bounds.x * (fraction < 0.5 ? 0.43 : 0.57)
          : x
    const velocity = launchVelocity(
      world.bounds,
      position,
      targetX,
      apexFraction + (plan.pattern === 'ladder' ? i * 0.025 : 0),
    )
    const fruitPick = FRUIT_PALETTE[random.nextInt(0, FRUIT_PALETTE.length - 1)]
    const entity = createFruitEntity({
      id: context?.nextGameplayId(),
      ...fruitPick,
      position,
      velocity,
      radius,
      rotationRad: randomRange(random, 0, Math.PI * 2),
      angularVelocityRadPerS: randomRange(random, -3.8, 3.8),
    })
    fruitWave.push(entity)
  }
  // Existing hazards (including resized trajectories) take precedence. Defer
  // the complete authored group when any slot loses its readable safe route.
  if (
    fruitWave.some((fruit) =>
      bombs.some((bomb) => !hasSafeHorizontalClearance(fruit, bomb, world.bounds)),
    )
  )
    fruitWave.length = 0
  for (let i = 0; i < fruitWave.length; i++) {
    world.spawn.pending.push({
      spawnAtMs: world.elapsedMs + i * plan.staggerMs,
      entity: fruitWave[i],
    })
  }

  if (
    fruitWave.length > 0 &&
    !modifiers.suppressBombSpawns &&
    bombs.length < plan.hazardBudget &&
    random.nextFloat() < plan.hazardChance
  ) {
    const radius = 30 * unitScale
    const x = world.bounds.x * (wave % 2 === 0 ? 0.09 : 0.91)
    const position = { x, y: world.bounds.y + radius + 12 * unitScale }
    const bomb = createBombEntity({
      id: context?.nextGameplayId(),
      color: '#111827',
      position,
      velocity: launchVelocity(world.bounds, position, x, apexFraction),
      radius,
      rotationRad: randomRange(random, 0, Math.PI * 2),
      angularVelocityRadPerS: randomRange(random, -3, 3),
    })
    const targets = [...occupied, ...fruitWave].filter(
      (entity) => entity.kind === 'fruit' || entity.kind === 'power-up',
    )
    if (targets.every((target) => hasSafeHorizontalClearance(target, bomb, world.bounds))) {
      world.spawn.pending.push({ spawnAtMs: world.elapsedMs, entity: bomb })
    }
  }

  // Pickups supplement fruit groups; they never replace a promised combo slot.
  if (
    state.mode === 'arcade' &&
    wave >= 3 &&
    world.elapsedMs >= 8000 &&
    plan.pattern !== 'recovery' &&
    occupied.filter((entity) => entity.kind === 'power-up').length < 2 &&
    random.nextFloat() < 0.18 + plan.progress * 0.12
  ) {
    const radius = 30 * unitScale
    const position = { x: world.bounds.x * 0.5, y: world.bounds.y + radius + 12 * unitScale }
    const pick = POWER_UP_PALETTE[random.nextInt(0, POWER_UP_PALETTE.length - 1)]
    const entity = createPowerUpEntity({
      id: context?.nextGameplayId(),
      ...pick,
      position,
      radius,
      velocity: launchVelocity(world.bounds, position, position.x, 0.23),
      rotationRad: 0,
      angularVelocityRadPerS: 0.8,
    })
    if (bombs.every((bomb) => hasSafeHorizontalClearance(entity, bomb, world.bounds))) {
      world.spawn.pending.push({ spawnAtMs: world.elapsedMs + 180, entity })
    }
  }

  world.spawn.wavesSpawned += 1
  // Frenzy's pressure increase and Freeze's breathing room affect scheduling,
  // while the authored recovery beat remains longer than its adjacent groups.
  world.spawn.nextWaveAtMs =
    world.elapsedMs +
    (plan.intervalMs * randomRange(random, 0.96, 1.04)) / Math.max(0.35, modifiers.spawnRateScale)
}
