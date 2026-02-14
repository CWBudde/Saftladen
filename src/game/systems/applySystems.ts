import type { GameState, SliceTrail } from '../types'
import { stepDespawnSystem } from './despawnSystem'
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
}

export function applyCoreSystems(
  state: GameState,
  dtMs: number,
  random: RandomSource,
  trails: SliceTrail[],
): SystemStepOutcome {
  stepSpawnSystem(state, random)
  stepPhysicsSystem(state, dtMs)
  detectSliceEvents(state, trails)
  const sliceOutcome = resolveSliceEvents(state, random)
  const despawnOutcome = stepDespawnSystem(state)

  return {
    missedFruits: despawnOutcome.missedFruits,
    bombHit: sliceOutcome.bombHit,
    fruitSlices: sliceOutcome.fruitSlices,
  }
}
