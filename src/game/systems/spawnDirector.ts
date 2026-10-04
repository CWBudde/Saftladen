import type { GameEntity, GameState, Vec2 } from '../types'
import { WORLD_GRAVITY_PX_PER_S2 } from './constants'

export type SpawnPattern = 'opening' | 'fan' | 'ladder' | 'alternating' | 'group' | 'recovery'
export type SpawnWavePlan = {
  pattern: SpawnPattern
  fruitCount: number
  intervalMs: number
  staggerMs: number
  hazardBudget: number
  fruitBudget: number
  hazardChance: number
  progress: number
}

const PATTERNS: SpawnPattern[] = ['fan', 'ladder', 'alternating', 'group', 'group', 'recovery']
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/** A deterministic authored rhythm; only visual/trajectory variation uses RNG. */
export function getSpawnWavePlan(state: GameState): SpawnWavePlan {
  const wave = state.world.spawn.wavesSpawned
  const progress =
    state.mode === 'arcade'
      ? clamp01(
          1 -
            state.modeState.arcade.remainingMs /
              Math.max(1, state.modeState.arcade.roundDurationMs),
        )
      : state.mode === 'classic'
        ? clamp01(state.world.elapsedMs / 90000)
        : 0
  const pattern = wave < 3 ? 'opening' : PATTERNS[(wave - 3) % PATTERNS.length]
  const recovery = pattern === 'recovery'
  const fruitCount =
    pattern === 'opening' || recovery
      ? 1
      : state.mode === 'zen'
        ? pattern === 'alternating'
          ? 2
          : 3
        : pattern === 'alternating'
          ? 2 + Math.floor(progress * 2)
          : 3 + Math.floor(progress * (state.mode === 'arcade' ? 3 : 2))
  const intervalMs =
    state.mode === 'zen'
      ? recovery
        ? 2200
        : 1450
      : state.mode === 'arcade'
        ? recovery
          ? 1450
          : 1050 - progress * 440
        : recovery
          ? 1850
          : 1400 - progress * 500
  return {
    pattern,
    fruitCount,
    intervalMs,
    progress,
    staggerMs: pattern === 'ladder' ? 110 : pattern === 'alternating' ? 160 : 0,
    hazardBudget: state.mode === 'classic' ? 2 : state.mode === 'arcade' ? 1 : 0,
    fruitBudget:
      state.mode === 'classic'
        ? 12
        : state.mode === 'zen'
          ? 9
          : state.modeState.arcade.powerUpTimers.frenzyMs > 0
            ? 30
            : 18,
    hazardChance:
      pattern === 'opening' || recovery || state.mode === 'zen'
        ? 0
        : state.mode === 'classic'
          ? 0.18 + progress * 0.3
          : 0.14 + progress * 0.18,
  }
}

export type TrajectoryEnvelope = { minX: number; maxX: number; minY: number; maxY: number }

/** Conservative future ballistic envelope including entity radius, useful for debug. */
export function getTrajectoryEnvelope(entity: GameEntity, bounds: Vec2): TrajectoryEnvelope {
  const { position, velocity, radius } = entity
  const below = Math.max(bounds.y + radius, position.y)
  const discriminant = Math.max(
    0,
    velocity.y * velocity.y + 2 * WORLD_GRAVITY_PX_PER_S2 * (below - position.y),
  )
  const flightSeconds = Math.max(
    0,
    (-velocity.y + Math.sqrt(discriminant)) / WORLD_GRAVITY_PX_PER_S2,
  )
  const endX = position.x + velocity.x * flightSeconds
  const apexSeconds = Math.max(0, Math.min(flightSeconds, -velocity.y / WORLD_GRAVITY_PX_PER_S2))
  const apexY =
    position.y +
    velocity.y * apexSeconds +
    (WORLD_GRAVITY_PX_PER_S2 * apexSeconds * apexSeconds) / 2
  return {
    minX: Math.min(position.x, endX) - radius,
    maxX: Math.max(position.x, endX) + radius,
    minY: Math.min(position.y, apexY) - radius,
    maxY: below + radius,
  }
}

export function hasSafeHorizontalClearance(a: GameEntity, b: GameEntity, bounds: Vec2): boolean {
  const first = getTrajectoryEnvelope(a, bounds)
  const second = getTrajectoryEnvelope(b, bounds)
  const clearance = 20 * Math.min(1, Math.min(bounds.x, bounds.y) / 720)
  return first.maxX + clearance <= second.minX || second.maxX + clearance <= first.minX
}
