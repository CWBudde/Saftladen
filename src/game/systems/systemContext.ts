import type { EntityId, PresentationEventPayload } from '../types'

export type RandomSource = {
  nextFloat: () => number
  nextInt: (minInclusive: number, maxInclusive: number) => number
}

export type SystemContext = {
  cosmeticRandom: RandomSource
  nextGameplayId: () => EntityId
  nextCosmeticId: () => EntityId
  events: PresentationEventPayload[]
  effectsEnabled: boolean
}
