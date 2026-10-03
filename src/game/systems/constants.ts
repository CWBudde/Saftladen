import type { ScoringConfig } from '../types'

export const WORLD_GRAVITY_PX_PER_S2 = 2200
export const PARTICLE_GRAVITY_PX_PER_S2 = 2800
export const OFFSCREEN_MARGIN_PX = 80
export const JUICE_PARTICLE_COUNT = 14
export const JUICE_SPLAT_DECAL_COUNT = 2
export const BASE_FRUIT_POINTS = 10
export const SCORE_FEEDBACK_LIFETIME_MS = 700
export const ARCADE_ROUND_DURATION_MS = 60000
export const ZEN_ROUND_DURATION_MS = 90000
export const FREEZE_POWER_UP_DURATION_MS = 4500
export const FRENZY_POWER_UP_DURATION_MS = 5200
export const DOUBLE_POINTS_POWER_UP_DURATION_MS = 6500

export const DEFAULT_SCORING: Readonly<ScoringConfig> = Object.freeze({
  baseFruitPoints: BASE_FRUIT_POINTS,
  strokeComboMinimum: 3,
  strokeComboBonus: 15,
  strokeComboExtraFruitBonus: 5,
  streakFruitInterval: 5,
  streakMultiplierStep: 0.25,
  maxStreakMultiplier: 2,
  streakWindowMs: 320,
})
