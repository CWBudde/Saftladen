import { getRankInfo, XP_PER_LEVEL, type RewardProfile } from './rewards'

export type CosmeticUnlock = {
  readonly id: string
  readonly name: string
  readonly metric: 'xp' | 'starfruit'
  readonly threshold: number
}

// Earned milestones, never prices. Ownership derives from persisted lifetime
// totals, so every unlocked item remains available as play adds more rewards.
export const DOJO_UNLOCKS = [
  { id: 'great-wave', name: 'Great Wave Dojo', metric: 'xp', threshold: 0 },
  { id: 'sunset-harbor', name: 'Sunset Harbor Dojo', metric: 'xp', threshold: 2 * XP_PER_LEVEL },
  { id: 'storm-temple', name: 'Storm Temple Dojo', metric: 'xp', threshold: 4 * XP_PER_LEVEL },
] as const satisfies readonly CosmeticUnlock[]

export const BLADE_UNLOCKS = [
  { id: 'bamboo', name: 'Bamboo Blade', metric: 'starfruit', threshold: 0 },
  { id: 'comet', name: 'Comet Blade', metric: 'starfruit', threshold: 40 },
  { id: 'dragon-fang', name: 'Dragon Fang', metric: 'starfruit', threshold: 110 },
] as const satisfies readonly CosmeticUnlock[]

export function getCosmeticUnlock(item: CosmeticUnlock, profile: Pick<RewardProfile, 'xp' | 'starfruit'>) {
  const earned = profile[item.metric]
  const unlocked = earned >= item.threshold
  const unit = item.metric === 'xp' ? 'XP' : 'Starfruit'
  const remaining = Math.max(0, item.threshold - earned)
  const requirement = item.threshold === 0
    ? 'Available from the start'
    : item.metric === 'xp'
      ? `Level ${getRankInfo(item.threshold).level} · ${item.threshold} XP earned`
      : `${item.threshold} Starfruit earned`
  return {
    unlocked,
    remaining,
    requirement,
    status: unlocked
      ? item.threshold === 0 ? 'Unlocked from the start' : `Unlocked · ${requirement}`
      : `${requirement} · ${Math.min(earned, item.threshold)}/${item.threshold} · ${remaining} ${unit} to go`,
  }
}
