import { getRankInfo, XP_PER_LEVEL, type RewardProfile } from './rewards'

export type CosmeticUnlock = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly metric: 'xp' | 'starfruit'
  readonly threshold: number
}

// Earned milestones, never prices. Ownership derives from persisted lifetime
// totals, so every unlocked item remains available as play adds more rewards.
export const DOJO_UNLOCKS = [
  { id: 'great-wave', name: 'Great Wave Dojo', description: 'Warm wood with a rolling jade wave.', metric: 'xp', threshold: 0 },
  { id: 'sunset-harbor', name: 'Sunset Harbor Dojo', description: 'Copper sunset over a quiet harbor.', metric: 'xp', threshold: 2 * XP_PER_LEVEL },
  { id: 'storm-temple', name: 'Storm Temple Dojo', description: 'Moonlit indigo mountains and a temple gate.', metric: 'xp', threshold: 4 * XP_PER_LEVEL },
] as const satisfies readonly CosmeticUnlock[]

export const BLADE_UNLOCKS = [
  { id: 'bamboo', name: 'Bamboo Blade', description: 'A cream edge wrapped in a fresh green trail.', metric: 'starfruit', threshold: 0 },
  { id: 'comet', name: 'Comet Blade', description: 'An icy blue edge with a violet comet tail.', metric: 'starfruit', threshold: 40 },
  { id: 'dragon-fang', name: 'Dragon Fang', description: 'A golden edge surrounded by ember red.', metric: 'starfruit', threshold: 110 },
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

export type BladeId = typeof BLADE_UNLOCKS[number]['id']
export type DojoId = typeof DOJO_UNLOCKS[number]['id']
export type CosmeticSelection = { blade: BladeId; dojo: DojoId }
export const DEFAULT_COSMETIC_SELECTION: Readonly<CosmeticSelection> = { blade: 'bamboo', dojo: 'great-wave' }
export const COSMETIC_SELECTION_STORAGE_KEY = 'saftladen.cosmetics.selection'
type EarnedTotals = Pick<RewardProfile, 'xp' | 'starfruit'>

/** Repair each slot independently; unknown or unearned items use the starter. */
export function normalizeCosmeticSelection(value: unknown, profile: EarnedTotals): CosmeticSelection {
  const raw = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
  const blade = BLADE_UNLOCKS.find(item => item.id === raw.blade && getCosmeticUnlock(item, profile).unlocked)
  const dojo = DOJO_UNLOCKS.find(item => item.id === raw.dojo && getCosmeticUnlock(item, profile).unlocked)
  return { blade: blade?.id ?? 'bamboo', dojo: dojo?.id ?? 'great-wave' }
}

export function loadCosmeticSelection(profile: EarnedTotals): CosmeticSelection {
  try {
    const raw = globalThis.localStorage?.getItem(COSMETIC_SELECTION_STORAGE_KEY)
    return normalizeCosmeticSelection(raw ? JSON.parse(raw) : null, profile)
  } catch {
    return { ...DEFAULT_COSMETIC_SELECTION }
  }
}

export function saveCosmeticSelection(selection: CosmeticSelection, profile: EarnedTotals): void {
  try {
    globalThis.localStorage?.setItem(COSMETIC_SELECTION_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, ...normalizeCosmeticSelection(selection, profile) }))
  } catch {
    // Selection remains usable for this session when storage is blocked/full.
  }
}

export function getNewCosmeticUnlocks(before: EarnedTotals, after: EarnedTotals): CosmeticUnlock[] {
  return [...BLADE_UNLOCKS, ...DOJO_UNLOCKS].filter(item =>
    !getCosmeticUnlock(item, before).unlocked && getCosmeticUnlock(item, after).unlocked)
}
