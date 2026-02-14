import type { GameState, SliceTrail } from '../types'
import { stepDespawnSystem } from './despawnSystem'
import { stepModeSystem } from './modeSystem'
import { stepPhysicsSystem } from './physicsSystem'
import { detectSliceEvents } from './sliceDetectSystem'
import { resolveSliceEvents } from './sliceResolveSystem'
import { stepSpawnSystem } from './spawnSystem'

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
): SystemStepOutcome {
  const modifiers = stepModeSystem(state, dtMs)
  stepSpawnSystem(state, random, modifiers)
  stepPhysicsSystem(state, dtMs * modifiers.physicsDtScale)
  detectSliceEvents(state, trails)
  const sliceOutcome = resolveSliceEvents(state, random, modifiers)
  const despawnOutcome = stepDespawnSystem(state)

  return {
    missedFruits: despawnOutcome.missedFruits,
    bombHit: sliceOutcome.bombHit,
    fruitSlices: sliceOutcome.fruitSlices,
    roundEnded: modifiers.roundEnded,
  }
}
