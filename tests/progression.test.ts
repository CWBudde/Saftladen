import { describe, expect, test } from 'bun:test'
import { applyRunRewards, createDefaultRewardProfile, type RunSummary } from '../src/game/ui/rewards'
import { getNextGoal, normalizeAchievements, normalizeChallengeBoard } from '../src/game/ui/progression'

let runIndex = 0
function run(mode: RunSummary['mode'], patch: Partial<RunSummary> = {}): RunSummary {
  return { runId: `goals:${runIndex++}`, mode, score: 200, durationMs: 60000,
    stats: { fruitSliced: 20, missedFruits: 1, bombHits: 0, peakCombo: 3,
      strokesAttempted: 15, successfulStrokes: 10, peakStrokeCombo: 3 }, ...patch }
}

describe('mode achievements', () => {
  test.each([
    ['classic', 'classic-safe', { fruitSliced: 20 }, {}],
    ['classic', 'classic-survival', {}, { durationMs: 60000 }],
    ['arcade', 'arcade-score', {}, { score: 500 }],
    ['arcade', 'arcade-stroke', { peakStrokeCombo: 4 }, {}],
    ['zen', 'zen-fruit', { fruitSliced: 40 }, {}],
    ['zen', 'zen-accuracy', { strokesAttempted: 25, successfulStrokes: 20 }, {}],
  ] as const)('%s / %s completes only in its mode and pays once', (mode, id, stats, patch) => {
    const initial = createDefaultRewardProfile()
    const summary = run(mode, patch)
    summary.stats = { ...summary.stats, ...stats }
    const goal = initial.achievements.find(goal => goal.id === id)!
    for (const other of ['classic', 'arcade', 'zen'] as const) {
      if (other === mode) continue
      const wrongMode = applyRunRewards(initial, { ...summary, mode: other })
      expect(wrongMode.profile.achievements.find(goal => goal.id === id)!.progress).toBe(0)
    }
    const first = applyRunRewards(initial, summary)
    expect(first.profile.achievements.find(goal => goal.id === id)!.completed).toBe(true)
    expect(first.rewards.goalCompletions).toContain(goal.title)
    const second = applyRunRewards(first.profile, { ...summary, runId: `repeat:${runIndex++}` })
    expect(second.rewards.goalCompletions).not.toContain(goal.title)
    const paidAlready = { ...initial, achievements: first.profile.achievements,
      challenges: first.profile.challenges }
    const withoutBonus = applyRunRewards(paidAlready, summary)
    const bonusGoals = [...first.profile.achievements, ...first.profile.challenges.goals]
      .filter(goal => first.rewards.goalCompletions.includes(goal.title))
    expect(first.rewards.xpEarned - withoutBonus.rewards.xpEarned).toBe(bonusGoals.reduce((sum, goal) => sum + goal.rewardXp, 0))
    expect(first.rewards.starfruitEarned - withoutBonus.rewards.starfruitEarned).toBe(bonusGoals.reduce((sum, goal) => sum + goal.rewardStarfruit, 0))
  })

  test('bombs invalidate safe fruit, while survival needs actual slicing', () => {
    const summary = run('classic')
    const hit = applyRunRewards(createDefaultRewardProfile(), { ...summary, stats: { ...summary.stats, bombHits: 1 } })
    expect(hit.profile.achievements.find(goal => goal.id === 'classic-safe')!.progress).toBe(0)
    const sparse = applyRunRewards(createDefaultRewardProfile(), { ...summary, stats: { ...summary.stats, fruitSliced: 19 } })
    expect(sparse.profile.achievements.find(goal => goal.id === 'classic-survival')!.progress).toBe(0)
    const short = applyRunRewards(createDefaultRewardProfile(), { ...summary, durationMs: 59999 })
    expect(short.profile.achievements.find(goal => goal.id === 'classic-survival')!.progress).toBe(59)
  })

  test('accuracy uses the exact ratio and a useful sample, rather than rounded display percent', () => {
    const summary = run('zen')
    for (const stats of [
      { ...summary.stats, fruitSliced: 19, successfulStrokes: 10, strokesAttempted: 10 },
      { ...summary.stats, successfulStrokes: 9, strokesAttempted: 9 },
      { ...summary.stats, successfulStrokes: 19, strokesAttempted: 24 },
    ]) {
      const result = applyRunRewards(createDefaultRewardProfile(), { ...summary, stats })
      expect(result.profile.achievements.find(goal => goal.id === 'zen-accuracy')!.completed).toBe(false)
    }
    for (const stats of [
      { ...summary.stats, successfulStrokes: 21, strokesAttempted: 20 },
      { ...summary.stats, successfulStrokes: 21, strokesAttempted: 22 },
      { ...summary.stats, peakStrokeCombo: 21 },
    ]) expect(applyRunRewards(createDefaultRewardProfile(), { ...summary, stats }).rewards.status).toBe('ineligible')
  })
})

describe('completion-driven challenges', () => {
  test('partial progress belongs to the played mode; completed slots stop paying', () => {
    let profile = createDefaultRewardProfile()
    const summary = run('arcade')
    summary.stats.fruitSliced = 10
    profile = applyRunRewards(profile, summary).profile
    expect(profile.challenges.goals.map(goal => goal.progress)).toEqual([0, 10, 0])
    const completion = applyRunRewards(profile, { ...summary, runId: 'partial:2' })
    expect(completion.rewards.goalCompletions).toEqual(['Arcade Small Harvest'])
    const repeat = applyRunRewards(completion.profile, { ...summary, runId: 'partial:3' })
    expect(repeat.rewards.goalCompletions).toEqual([])
    expect(repeat.profile.challenges.cycle).toBe(0)
    expect(repeat.profile.challenges.goals[1].progress).toBe(20)
    expect(profile.challenges.goals[1].progress).toBe(10)
  })

  test('every set rotates, wraps indefinitely, and never credits a new set from the closing run', () => {
    let profile = createDefaultRewardProfile()
    for (let round = 0; round < 6; round++) {
      expect(profile.challenges.cycle).toBe(round % 3)
      const runsPerMode = round % 3 === 1 ? 2 : 1
      for (const mode of ['classic', 'arcade', 'zen'] as const) {
        for (let count = 0; count < runsPerMode; count++) {
          const summary = run(mode)
          const result = applyRunRewards(profile, summary)
          const closing = mode === 'zen' && count === runsPerMode - 1
          expect(result.rewards.challengesRotated).toBe(closing)
          profile = result.profile
          const duplicate = applyRunRewards(profile, summary)
          expect(duplicate.profile).toBe(profile)
          expect(duplicate.rewards.goalCompletions).toEqual([])
          expect(duplicate.rewards.challengesRotated).toBe(false)
        }
      }
      expect(profile.challenges.goals.every(goal => goal.progress === 0 && !goal.completed)).toBe(true)
    }
  })

  test('ineligible runs cannot progress any goal or rotate a board', () => {
    const profile = createDefaultRewardProfile()
    for (const patch of [{ durationMs: 4999 }, { score: 0 }, { durationMs: Number.NaN }]) {
      const result = applyRunRewards(profile, run('zen', patch))
      expect(result.profile.challenges).toBe(profile.challenges)
      expect(result.profile.achievements).toBe(profile.achievements)
      expect(result.rewards.goalCompletions).toEqual([])
    }
  })

  test('goals remain available after every initial objective and achievement finishes', () => {
    const profile = createDefaultRewardProfile()
    profile.objectives = profile.objectives.map(goal => ({ ...goal, completed: true, progress: goal.target }))
    profile.achievements = profile.achievements.map(goal => ({ ...goal, completed: true, progress: goal.target }))
    for (const mode of ['classic', 'arcade', 'zen'] as const) {
      expect(getNextGoal(profile, mode).mode).toBe(mode)
      expect(getNextGoal(profile, mode).completed).toBe(false)
    }
    profile.challenges.goals[0].completed = true
    expect(getNextGoal(profile, 'classic').mode).toBe('arcade')
    profile.achievements[0].completed = false
    expect(getNextGoal(profile, 'classic').id).toBe('classic-safe')
  })

  test('normalization fixes malformed siblings and never trusts saved goal targets or payouts', () => {
    const achievements = normalizeAchievements([null, { id: 'arcade-stroke', progress: 3,
      target: 1, rewardXp: 999999, mode: 'zen', title: 'Changed' }])
    expect(achievements.find(goal => goal.id === 'arcade-stroke')).toMatchObject({
      target: 4, progress: 3, completed: false, rewardXp: 100, mode: 'arcade', title: 'Four in a Flash',
    })
    for (const cycle of [-1, Number.NaN, '2', null]) expect(normalizeChallengeBoard({ cycle }).cycle).toBe(0)
    const board = normalizeChallengeBoard({ cycle: 4, goals: [null,
      { id: 'harvest-classic', completed: true },
      { id: 'practice-zen', progress: 1, rewardStarfruit: 99999 },
    ] })
    expect(board.cycle).toBe(1)
    expect(board.goals.map(goal => goal.progress)).toEqual([0, 0, 1])
    expect(board.goals[2].rewardStarfruit).toBe(4)
  })
})
