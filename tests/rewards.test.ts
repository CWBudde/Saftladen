import { describe, expect, test } from 'bun:test'
import {
  applyRunRewards, createDefaultRewardProfile, MIN_REWARDED_RUN_DURATION_MS,
  SETTLED_RUN_HISTORY_LIMIT, type RunSummary,
} from '../src/game/ui/rewards'

function summary(patch: Partial<RunSummary> = {}): RunSummary {
  return {
    runId: 'session-a:1', mode: 'arcade', score: 140, durationMs: 60000,
    stats: { fruitSliced: 10, missedFruits: 0, bombHits: 0, peakCombo: 3, strokesAttempted: 5, successfulStrokes: 4, peakStrokeCombo: 3 },
    ...patch,
  }
}

describe('rewards reflect actual play', () => {
  test.each(['classic', 'arcade', 'zen'] as const)('%s clean bonus requires no bomb hits or fruit misses', (mode) => {
    const run = summary({ mode })
    const clean = applyRunRewards(createDefaultRewardProfile(), run)
    for (const stats of [{ ...run.stats, bombHits: 1 }, { ...run.stats, missedFruits: 1 }]) {
      const damaged = applyRunRewards(createDefaultRewardProfile(), { ...run, stats })
      expect(clean.rewards.flawless).toBe(true)
      expect(damaged.rewards.flawless).toBe(false)
      expect(clean.rewards.xpEarned - damaged.rewards.xpEarned).toBe(20)
      expect(clean.rewards.starfruitEarned - damaged.rewards.starfruitEarned).toBe(2)
    }
  })

  test.each([
    { score: 0, stats: { fruitSliced: 0, missedFruits: 0, bombHits: 0, peakCombo: 0, strokesAttempted: 5, successfulStrokes: 0, peakStrokeCombo: 0 } },
    { score: 100, stats: { fruitSliced: 0, missedFruits: 0, bombHits: 1, peakCombo: 0, strokesAttempted: 5, successfulStrokes: 0, peakStrokeCombo: 0 } },
    { durationMs: MIN_REWARDED_RUN_DURATION_MS - 1 },
  ])('empty, power-up-only and instant-loss runs earn nothing: %j', (patch) => {
    const initial = createDefaultRewardProfile()
    const result = applyRunRewards(initial, summary(patch))
    expect(result.rewards.status).toBe('ineligible')
    expect(result.rewards.xpEarned).toBe(0)
    expect(result.rewards.starfruitEarned).toBe(0)
    expect(result.profile.totalRuns).toBe(0)
    expect(result.profile.objectives).toEqual(initial.objectives)
    expect(result.profile.settledRunIds).toEqual(['session-a:1'])
  })

  test('a played run is eligible at the minimum duration', () => {
    const result = applyRunRewards(createDefaultRewardProfile(), summary({ durationMs: MIN_REWARDED_RUN_DURATION_MS }))
    expect(result.rewards.status).toBe('earned')
    expect(result.rewards.xpEarned).toBeGreaterThan(0)
    expect(result.profile.totalRuns).toBe(1)
  })

  test('malformed numeric summaries never mint rewards', () => {
    const run = summary()
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const badScore = applyRunRewards(createDefaultRewardProfile(), { ...run, score: value })
      const badStats = applyRunRewards(createDefaultRewardProfile(), { ...run, stats: { ...run.stats, bombHits: value } })
      expect(badScore.rewards.status).toBe('ineligible')
      expect(badStats.rewards.status).toBe('ineligible')
      expect(badStats.profile.xp).toBe(0)
    }
  })
})

describe('reward settlement is idempotent', () => {
  test('repeated terminal events preserve profile identity and pay once', () => {
    const initial = createDefaultRewardProfile()
    const first = applyRunRewards(initial, summary())
    const second = applyRunRewards(first.profile, summary())
    expect(second.profile).toBe(first.profile)
    expect(second.rewards.status).toBe('already-settled')
    expect(second.rewards.xpEarned).toBe(0)
    expect(second.rewards.starfruitEarned).toBe(0)
    expect(first.profile.totalRuns).toBe(1)
    expect(initial.totalRuns).toBe(0)
    expect(initial.settledRunIds).toEqual([])
  })

  test('a rejected run cannot later be reinterpreted as a payout', () => {
    const first = applyRunRewards(createDefaultRewardProfile(), summary({ durationMs: 1 }))
    const repeated = applyRunRewards(first.profile, summary())
    expect(repeated.profile).toBe(first.profile)
    expect(repeated.rewards.status).toBe('already-settled')
    expect(repeated.profile.totalRuns).toBe(0)
  })

  test('objective bonuses award once and progress stops at the objective target', () => {
    let profile = createDefaultRewardProfile()
    const completed: string[] = []
    for (let index = 0; index < 8; index++) {
      const result = applyRunRewards(profile, summary({
        runId: `objectives:${index}`, score: 350,
        stats: { fruitSliced: 12, missedFruits: 1, bombHits: 0, peakCombo: 6, strokesAttempted: 5, successfulStrokes: 4, peakStrokeCombo: 3 },
      }))
      profile = result.profile
      completed.push(...result.rewards.objectiveCompletions)
    }
    expect(completed.sort()).toEqual(['Score Hunter', 'Streak Student', 'Warmup Ritual'])
    expect(profile.objectives.every((objective) => objective.completed && objective.progress === objective.target)).toBe(true)
    expect(profile.totalRuns).toBe(8)
  })

  test('recent settlement history is bounded and still rejects recent duplicates', () => {
    let profile = createDefaultRewardProfile()
    for (let index = 0; index < SETTLED_RUN_HISTORY_LIMIT + 3; index++) {
      profile = applyRunRewards(profile, summary({ runId: `history:${index}`, durationMs: 0 })).profile
    }
    expect(profile.settledRunIds).toHaveLength(SETTLED_RUN_HISTORY_LIMIT)
    expect(profile.settledRunIds[0]).toBe('history:3')
    expect(applyRunRewards(profile, summary({ runId: `history:${SETTLED_RUN_HISTORY_LIMIT + 2}` })).rewards.status).toBe('already-settled')
  })
})
