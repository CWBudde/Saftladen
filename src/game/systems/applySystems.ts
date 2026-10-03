import type { GameState, SliceTrail, Vec2 } from '../types'
import { stepDespawnSystem } from './despawnSystem'
import { stepModeSystem } from './modeSystem'
import { stepPhysicsSystem } from './physicsSystem'
import { detectSliceEvents } from './sliceDetectSystem'
import { resolveSliceEvents } from './sliceResolveSystem'
import { stepSpawnSystem } from './spawnSystem'
import type { SystemContext } from './systemContext'

type RandomSource = {
  nextFloat: () => number
  nextInt: (minInclusive: number, maxInclusive: number) => number
}

export type SystemStepOutcome = {
  missedFruits: number
  bombHit: boolean
  fruitSlices: number
  roundEnded: boolean
}

export function applyCoreSystems(
  state: GameState,
  dtMs: number,
  random: RandomSource,
  trails: SliceTrail[],
  context?: SystemContext,
): SystemStepOutcome {
  const modifiers = stepModeSystem(state, dtMs, context?.events)
  stepSpawnSystem(state, random, modifiers, context)
  const previousPositions = trails.some((trail) => trail.points.length > 1) ? new Map<string, Vec2>() : undefined
  stepPhysicsSystem(state, dtMs * modifiers.physicsDtScale, previousPositions)
  detectSliceEvents(state, trails, previousPositions)
  const sliceOutcome = resolveSliceEvents(state, context?.cosmeticRandom ?? random, modifiers, context)
  const despawnOutcome = stepDespawnSystem(state, context?.events)

  return {
    missedFruits: despawnOutcome.missedFruits,
    bombHit: sliceOutcome.bombHit,
    fruitSlices: sliceOutcome.fruitSlices,
    roundEnded: modifiers.roundEnded,
  }
}
