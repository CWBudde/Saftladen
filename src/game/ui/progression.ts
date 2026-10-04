import type { GameMode } from '../types'
import type { RewardProfile, RunSummary } from './rewards'

export type GoalMetric =
  | 'fruit-total'
  | 'played-runs'
  | 'stroke-combo'
  | 'score'
  | 'safe-fruit'
  | 'survival-seconds'
  | 'accuracy'
export type ProgressionGoal = {
  id: string
  mode: GameMode
  title: string
  description: string
  metric: GoalMetric
  target: number
  progress: number
  completed: boolean
  rewardXp: number
  rewardStarfruit: number
}
type GoalTemplate = Omit<ProgressionGoal, 'progress' | 'completed'>
export type ChallengeBoard = { cycle: number; goals: ProgressionGoal[] }
export const MODE_NAMES: Record<GameMode, string> = {
  classic: 'Classic',
  arcade: 'Arcade',
  zen: 'Zen',
}

const ACHIEVEMENTS: GoalTemplate[] = [
  {
    id: 'classic-safe',
    mode: 'classic',
    title: 'Steady Blade',
    description: 'Classic: slice 20 fruit in one run without hitting a bomb.',
    metric: 'safe-fruit',
    target: 20,
    rewardXp: 100,
    rewardStarfruit: 12,
  },
  {
    id: 'classic-survival',
    mode: 'classic',
    title: 'Stall Guardian',
    description: 'Classic: survive 60 seconds and slice at least 20 fruit.',
    metric: 'survival-seconds',
    target: 60,
    rewardXp: 140,
    rewardStarfruit: 18,
  },
  {
    id: 'arcade-score',
    mode: 'arcade',
    title: 'Rush Hour',
    description: 'Arcade: reach 500 score in one run.',
    metric: 'score',
    target: 500,
    rewardXp: 140,
    rewardStarfruit: 18,
  },
  {
    id: 'arcade-stroke',
    mode: 'arcade',
    title: 'Four in a Flash',
    description: 'Arcade: slice 4 fruit in one stroke.',
    metric: 'stroke-combo',
    target: 4,
    rewardXp: 100,
    rewardStarfruit: 12,
  },
  {
    id: 'zen-fruit',
    mode: 'zen',
    title: 'Fruit Garden',
    description: 'Zen: slice 40 fruit in one run.',
    metric: 'safe-fruit',
    target: 40,
    rewardXp: 100,
    rewardStarfruit: 12,
  },
  {
    id: 'zen-accuracy',
    mode: 'zen',
    title: 'Mindful Swipes',
    description: 'Zen: reach 80% stroke accuracy with at least 20 fruit and 10 successful strokes.',
    metric: 'accuracy',
    target: 80,
    rewardXp: 140,
    rewardStarfruit: 18,
  },
]

const MODES: GameMode[] = ['classic', 'arcade', 'zen']
const CHALLENGE_SETS = [
  {
    id: 'harvest',
    title: 'Small Harvest',
    metric: 'fruit-total',
    target: 20,
    description: 'Slice 20 fruit across rewarded runs.',
    rewardXp: 40,
    rewardStarfruit: 4,
  },
  {
    id: 'practice',
    title: 'Back to the Stall',
    metric: 'played-runs',
    target: 2,
    description: 'Finish 2 rewarded runs; slice fruit and play at least 5 seconds each.',
    rewardXp: 40,
    rewardStarfruit: 4,
  },
  {
    id: 'gesture',
    title: 'Three Together',
    metric: 'stroke-combo',
    target: 3,
    description: 'Slice 3 fruit in one stroke in a rewarded run.',
    rewardXp: 50,
    rewardStarfruit: 5,
  },
] satisfies Omit<GoalTemplate, 'mode'>[]

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
function integer(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)))
    : 0
}
function normalizeGoals(templates: GoalTemplate[], value: unknown): ProgressionGoal[] {
  const entries = new Map(
    (Array.isArray(value) ? value : []).map((entry) => {
      const raw = record(entry)
      return [raw.id, raw] as const
    }),
  )
  return templates.map((template) => {
    const raw = entries.get(template.id) ?? {}
    const progress = Math.min(template.target, integer(raw.progress))
    const completed = raw.completed === true || progress === template.target
    return { ...template, progress: completed ? template.target : progress, completed }
  })
}

export function normalizeAchievements(value: unknown): ProgressionGoal[] {
  return normalizeGoals(ACHIEVEMENTS, value)
}
export function normalizeChallengeBoard(value: unknown): ChallengeBoard {
  const raw = record(value)
  // A bounded set index is enough: no calendar, growing ledger or escalating targets.
  const cycle = integer(raw.cycle) % CHALLENGE_SETS.length
  const set = CHALLENGE_SETS[cycle]
  const templates = MODES.map((mode) => ({
    ...set,
    id: `${set.id}-${mode}`,
    mode,
    title: `${MODE_NAMES[mode]} ${set.title}`,
    description: `${MODE_NAMES[mode]}: ${set.description}`,
  }))
  return { cycle, goals: normalizeGoals(templates, raw.goals) }
}

function advanceGoal(goal: ProgressionGoal, run: RunSummary): ProgressionGoal {
  if (goal.completed || goal.mode !== run.mode) return goal
  let measured = 0
  switch (goal.metric) {
    case 'fruit-total':
      measured = goal.progress + run.stats.fruitSliced
      break
    case 'played-runs':
      measured = goal.progress + 1
      break
    case 'stroke-combo':
      measured = run.stats.peakStrokeCombo
      break
    case 'score':
      measured = run.score
      break
    case 'safe-fruit':
      measured = run.stats.bombHits === 0 ? run.stats.fruitSliced : 0
      break
    case 'survival-seconds':
      measured = run.stats.fruitSliced >= 20 ? Math.floor(run.durationMs / 1000) : 0
      break
    case 'accuracy':
      measured =
        run.stats.fruitSliced >= 20 &&
        run.stats.successfulStrokes >= 10 &&
        run.stats.strokesAttempted > 0
          ? Math.floor((100 * run.stats.successfulStrokes) / run.stats.strokesAttempted)
          : 0
      break
  }
  const progress = Math.min(goal.target, Math.max(goal.progress, measured))
  return { ...goal, progress, completed: progress === goal.target }
}

/** Only call inside eligible, exactly-once run settlement. New boards start next run. */
export function applyProgression(profile: RewardProfile, run: RunSummary) {
  const completions: string[] = []
  let bonusXp = 0
  let bonusStarfruit = 0
  const advance = (goal: ProgressionGoal) => {
    const next = advanceGoal(goal, run)
    if (!goal.completed && next.completed) {
      completions.push(next.title)
      bonusXp += next.rewardXp
      bonusStarfruit += next.rewardStarfruit
    }
    return next
  }
  const achievements = profile.achievements.map(advance)
  let challenges = { ...profile.challenges, goals: profile.challenges.goals.map(advance) }
  const challengesRotated = challenges.goals.every((goal) => goal.completed)
  if (challengesRotated) challenges = normalizeChallengeBoard({ cycle: challenges.cycle + 1 })
  return { achievements, challenges, completions, bonusXp, bonusStarfruit, challengesRotated }
}

export function getNextGoal(profile: RewardProfile, preferredMode: GameMode): ProgressionGoal {
  const pending = [...profile.challenges.goals, ...profile.achievements].filter(
    (goal) => !goal.completed,
  )
  return (
    pending.find((goal) => goal.mode === preferredMode) ??
    pending[0] ??
    // Also handles an all-completed saved board before its next eligible settlement.
    normalizeChallengeBoard({ cycle: profile.challenges.cycle + 1 }).goals.find(
      (goal) => goal.mode === preferredMode,
    )!
  )
}
