import type { GameMode } from '../types'

export type RewardObjectiveId = 'runs' | 'combo' | 'score'
export type RewardObjectiveMetric = 'runs' | 'max-combo' | 'best-score'

export type RewardObjective = {
  id: RewardObjectiveId
  title: string
  description: string
  target: number
  progress: number
  metric: RewardObjectiveMetric
  completed: boolean
  rewardXp: number
  rewardStarfruit: number
}

export type RewardProfile = {
  xp: number
  starfruit: number
  totalRuns: number
  totalScore: number
  bestCombo: number
  bestScore: number
  objectives: RewardObjective[]
}

export type RunSummary = {
  mode: GameMode
  score: number
  maxCombo: number
  durationMs: number
  strikesRemaining: number
  strikesMax: number
}

export type RunRewards = {
  xpEarned: number
  starfruitEarned: number
  objectiveCompletions: string[]
}

type ObjectiveTemplate = Omit<RewardObjective, 'progress' | 'completed'>

const OBJECTIVE_TEMPLATES: ObjectiveTemplate[] = [
  {
    id: 'runs',
    title: 'Warmup Ritual',
    description: 'Complete 5 runs',
    target: 5,
    metric: 'runs',
    rewardXp: 80,
    rewardStarfruit: 10,
  },
  {
    id: 'combo',
    title: 'Combo Student',
    description: 'Reach combo x6',
    target: 6,
    metric: 'max-combo',
    rewardXp: 120,
    rewardStarfruit: 16,
  },
  {
    id: 'score',
    title: 'Score Hunter',
    description: 'Reach 350 score in a run',
    target: 350,
    metric: 'best-score',
    rewardXp: 180,
    rewardStarfruit: 24,
  },
]

export const REWARD_PROFILE_STORAGE_KEY = 'fruitninja.rewards.profile'
const XP_PER_LEVEL = 280
const RANK_NAMES = ['Novice', 'Apprentice', 'Sensei', 'Master', 'Grandmaster'] as const

function createDefaultObjectives(): RewardObjective[] {
  return OBJECTIVE_TEMPLATES.map((template) => ({
    ...template,
    progress: 0,
    completed: false,
  }))
}

export function createDefaultRewardProfile(): RewardProfile {
  return {
    xp: 0,
    starfruit: 0,
    totalRuns: 0,
    totalScore: 0,
    bestCombo: 0,
    bestScore: 0,
    objectives: createDefaultObjectives(),
  }
}

function coerceObjective(raw: Partial<RewardObjective>, template: ObjectiveTemplate): RewardObjective {
  const progress = typeof raw.progress === 'number' ? Math.max(0, raw.progress) : 0
  const completed = typeof raw.completed === 'boolean' ? raw.completed : progress >= template.target
  return {
    ...template,
    progress,
    completed,
  }
}

export function loadRewardProfile(): RewardProfile {
  const defaults = createDefaultRewardProfile()

  try {
    const raw = globalThis.localStorage?.getItem(REWARD_PROFILE_STORAGE_KEY)
    if (!raw) {
      return defaults
    }

    const parsed = JSON.parse(raw) as Partial<RewardProfile>
    const parsedObjectives = Array.isArray(parsed.objectives) ? parsed.objectives : []
    const objectiveById = new Map(parsedObjectives.map((objective) => [objective.id, objective as Partial<RewardObjective>]))

    return {
      xp: typeof parsed.xp === 'number' ? Math.max(0, Math.floor(parsed.xp)) : defaults.xp,
      starfruit:
        typeof parsed.starfruit === 'number' ? Math.max(0, Math.floor(parsed.starfruit)) : defaults.starfruit,
      totalRuns:
        typeof parsed.totalRuns === 'number' ? Math.max(0, Math.floor(parsed.totalRuns)) : defaults.totalRuns,
      totalScore:
        typeof parsed.totalScore === 'number' ? Math.max(0, Math.floor(parsed.totalScore)) : defaults.totalScore,
      bestCombo:
        typeof parsed.bestCombo === 'number' ? Math.max(0, Math.floor(parsed.bestCombo)) : defaults.bestCombo,
      bestScore:
        typeof parsed.bestScore === 'number' ? Math.max(0, Math.floor(parsed.bestScore)) : defaults.bestScore,
      objectives: OBJECTIVE_TEMPLATES.map((template) => coerceObjective(objectiveById.get(template.id) ?? {}, template)),
    }
  } catch {
    return defaults
  }
}

export function saveRewardProfile(profile: RewardProfile): void {
  try {
    globalThis.localStorage?.setItem(REWARD_PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Ignore persistence failures in restricted runtimes.
  }
}

export function getRankInfo(xp: number): { level: number; rankName: string; levelProgress: number } {
  const safeXp = Math.max(0, xp)
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1
  const levelProgress = (safeXp % XP_PER_LEVEL) / XP_PER_LEVEL
  const rankIndex = Math.min(RANK_NAMES.length - 1, Math.floor((level - 1) / 3))
  return {
    level,
    rankName: RANK_NAMES[rankIndex],
    levelProgress,
  }
}

function calculateBaseRewards(summary: RunSummary): { xp: number; starfruit: number } {
  const scoreXp = Math.floor(summary.score * 0.45)
  const comboXp = Math.max(0, summary.maxCombo - 1) * 12
  const modeXp = summary.mode === 'arcade' ? 40 : 25
  const survivalXp = summary.strikesRemaining === summary.strikesMax ? 20 : 0
  const xp = modeXp + scoreXp + comboXp + survivalXp

  const starfruitFromScore = Math.floor(summary.score / 70)
  const starfruitFromCombo = Math.max(0, summary.maxCombo - 2)
  const flawlessBonus = summary.strikesRemaining === summary.strikesMax ? 2 : 0
  const starfruit = starfruitFromScore + starfruitFromCombo + flawlessBonus

  return { xp, starfruit }
}

function applyObjectiveProgress(objective: RewardObjective, summary: RunSummary): RewardObjective {
  if (objective.metric === 'runs') {
    const progress = objective.progress + 1
    return {
      ...objective,
      progress,
      completed: objective.completed || progress >= objective.target,
    }
  }

  if (objective.metric === 'max-combo') {
    const progress = Math.max(objective.progress, summary.maxCombo)
    return {
      ...objective,
      progress,
      completed: objective.completed || progress >= objective.target,
    }
  }

  const progress = Math.max(objective.progress, summary.score)
  return {
    ...objective,
    progress,
    completed: objective.completed || progress >= objective.target,
  }
}

export function applyRunRewards(
  profile: RewardProfile,
  summary: RunSummary,
): { profile: RewardProfile; rewards: RunRewards } {
  const baseRewards = calculateBaseRewards(summary)
  const objectiveCompletions: string[] = []

  let bonusXp = 0
  let bonusStarfruit = 0
  const objectives = profile.objectives.map((objective) => {
    const next = applyObjectiveProgress(objective, summary)
    if (!objective.completed && next.completed) {
      objectiveCompletions.push(next.title)
      bonusXp += next.rewardXp
      bonusStarfruit += next.rewardStarfruit
    }
    return next
  })

  const xpEarned = baseRewards.xp + bonusXp
  const starfruitEarned = baseRewards.starfruit + bonusStarfruit

  return {
    profile: {
      xp: profile.xp + xpEarned,
      starfruit: profile.starfruit + starfruitEarned,
      totalRuns: profile.totalRuns + 1,
      totalScore: profile.totalScore + summary.score,
      bestCombo: Math.max(profile.bestCombo, summary.maxCombo),
      bestScore: Math.max(profile.bestScore, summary.score),
      objectives,
    },
    rewards: {
      xpEarned,
      starfruitEarned,
      objectiveCompletions,
    },
  }
}
