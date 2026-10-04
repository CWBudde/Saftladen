import { describe, expect, test } from 'bun:test'
import {
  BLADE_UNLOCKS,
  DOJO_UNLOCKS,
  getCosmeticUnlock,
  getNewCosmeticUnlocks,
} from '../src/game/ui/cosmetics'
import {
  applyRunRewards,
  createDefaultRewardProfile,
  type RunSummary,
} from '../src/game/ui/rewards'

const catalog = [...BLADE_UNLOCKS, ...DOJO_UNLOCKS]

describe('earned cosmetic milestones', () => {
  test('celebrations include only thresholds crossed by this settlement', () => {
    const before = { ...createDefaultRewardProfile(), xp: 559, starfruit: 39 }
    const after = { ...before, xp: 1120, starfruit: 110 }
    expect(getNewCosmeticUnlocks(before, after).map((item) => item.id)).toEqual([
      'comet',
      'dragon-fang',
      'sunset-harbor',
      'storm-temple',
    ])
    expect(getNewCosmeticUnlocks(after, after)).toEqual([])
    expect(getNewCosmeticUnlocks(createDefaultRewardProfile(), before)).toEqual([])
  })
  test('starter cosmetics are available with an empty profile', () => {
    const profile = createDefaultRewardProfile()
    expect(
      catalog.filter((item) => getCosmeticUnlock(item, profile).unlocked).map((item) => item.id),
    ).toEqual(['bamboo', 'great-wave'])
  })

  test.each(catalog.filter((item) => item.threshold > 0))(
    '$name unlocks at its exact lifetime threshold',
    (item) => {
      const below = { ...createDefaultRewardProfile(), [item.metric]: item.threshold - 1 }
      const at = { ...below, [item.metric]: item.threshold }
      const above = { ...at, [item.metric]: item.threshold + 7 }
      expect(getCosmeticUnlock(item, below).unlocked).toBe(false)
      expect(getCosmeticUnlock(item, below).remaining).toBe(1)
      expect(getCosmeticUnlock(item, at).unlocked).toBe(true)
      expect(getCosmeticUnlock(item, at).remaining).toBe(0)
      expect(getCosmeticUnlock(item, above).unlocked).toBe(true)
      expect(getCosmeticUnlock(item, above).remaining).toBe(0)
      // Resolving ownership never charges XP/Starfruit or edits the saved profile.
      expect(at[item.metric]).toBe(item.threshold)
      expect(above[item.metric]).toBe(item.threshold + 7)
    },
  )

  test.each(['classic', 'arcade', 'zen'] as const)(
    '%s repeatable imperfect runs can unlock everything without skill-objective bonuses',
    (mode) => {
      let profile = createDefaultRewardProfile()
      const firstUnlocked = new Map<string, number>()
      for (let run = 1; run <= 25; run++) {
        const summary: RunSummary = {
          runId: `progression:${mode}:${run}`,
          mode,
          score: 210,
          durationMs: 60000,
          stats: {
            fruitSliced: 20,
            missedFruits: 1,
            bombHits: 0,
            peakCombo: 3,
            strokesAttempted: 12,
            successfulStrokes: 10,
            peakStrokeCombo: 3,
          },
        }
        const previous = profile
        profile = applyRunRewards(profile, summary).profile
        expect(profile.starfruit).toBeGreaterThan(previous.starfruit)
        expect(profile.xp).toBeGreaterThan(previous.xp)
        expect(applyRunRewards(profile, summary).profile).toBe(profile)
        for (const item of catalog) {
          if (getCosmeticUnlock(item, profile).unlocked && !firstUnlocked.has(item.id))
            firstUnlocked.set(item.id, run)
          if (getCosmeticUnlock(item, previous).unlocked)
            expect(getCosmeticUnlock(item, profile).unlocked).toBe(true)
        }
      }
      const expected = { classic: [2, 17, 144], arcade: [7, 24, 114], zen: [5, 20, 132] }[mode]
      expect(firstUnlocked.get('comet')).toBe(expected[0])
      expect(firstUnlocked.get('dragon-fang')).toBe(expected[1])
      expect(firstUnlocked.get('storm-temple')).toBeLessThanOrEqual(8)
      expect(
        profile.objectives
          .filter((objective) => objective.completed)
          .map((objective) => objective.id),
      ).toEqual(['runs'])
      expect(profile.starfruit).toBe(expected[2])
      expect(catalog.every((item) => getCosmeticUnlock(item, profile).unlocked)).toBe(true)
    },
  )
})
