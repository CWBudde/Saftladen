import type { GameMode, RunStats } from '../types'

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
  schemaVersion: 2
  settledRunIds: string[]
  xp: number
  starfruit: number
  totalRuns: number
  totalScore: number
  bestCombo: number
  bestScore: number
  objectives: RewardObjective[]
}

export type RunSummary = {
  runId: string
  mode: GameMode
  score: number
  durationMs: number
  stats: RunStats
}

export type RunRewards = {
  status: 'earned' | 'ineligible' | 'already-settled'
  flawless: boolean
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
    title: 'Streak Student',
    description: 'Reach streak x6',
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

export const REWARD_PROFILE_STORAGE_KEY = 'saftladen.rewards.profile'
export const REWARD_PROFILE_SCHEMA_VERSION = 2
export const SETTLED_RUN_HISTORY_LIMIT = 128
export const MIN_REWARDED_RUN_DURATION_MS = 5000
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
    schemaVersion: REWARD_PROFILE_SCHEMA_VERSION,
    settledRunIds: [],
    xp: 0,
    starfruit: 0,
    totalRuns: 0,
    totalScore: 0,
    bestCombo: 0,
    bestScore: 0,
    objectives: createDefaultObjectives(),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function safeInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)))
    : fallback
}

function validRunId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
}

function coerceObjective(raw: Record<string, unknown>, template: ObjectiveTemplate): RewardObjective {
  const progress = Math.min(template.target, safeInteger(raw.progress))
  const completed = raw.completed === true || progress >= template.target
  return { ...template, progress: completed ? template.target : progress, completed }
}

/** Migrate the original flat profile while validating fields independently. */
function normalizeRewardProfile(value: unknown): RewardProfile {
  const parsed = asRecord(value)
  const parsedObjectives = Array.isArray(parsed.objectives) ? parsed.objectives : []
  const objectiveById = new Map<string, Record<string, unknown>>()
  for (const value of parsedObjectives) {
    const objective = asRecord(value)
    if (typeof objective.id === 'string') objectiveById.set(objective.id, objective)
  }
  const ids = Array.isArray(parsed.settledRunIds) ? parsed.settledRunIds.filter(validRunId) : []
  return {
    schemaVersion: REWARD_PROFILE_SCHEMA_VERSION,
    settledRunIds: [...new Set(ids)].slice(-SETTLED_RUN_HISTORY_LIMIT),
    xp: safeInteger(parsed.xp),
    starfruit: safeInteger(parsed.starfruit),
    totalRuns: safeInteger(parsed.totalRuns),
    totalScore: safeInteger(parsed.totalScore),
    bestCombo: safeInteger(parsed.bestCombo),
    bestScore: safeInteger(parsed.bestScore),
    objectives: OBJECTIVE_TEMPLATES.map((template) => coerceObjective(objectiveById.get(template.id) ?? {}, template)),
  }
}

export function loadRewardProfile(): RewardProfile {
  try {
    const raw = globalThis.localStorage?.getItem(REWARD_PROFILE_STORAGE_KEY)
    return raw ? normalizeRewardProfile(JSON.parse(raw)) : createDefaultRewardProfile()
  } catch {
    return createDefaultRewardProfile()
  }
}

export function saveRewardProfile(profile: RewardProfile): void {
  try {
    globalThis.localStorage?.setItem(REWARD_PROFILE_STORAGE_KEY, JSON.stringify(normalizeRewardProfile(profile)))
  } catch {
    // Ignore persistence failures in restricted runtimes.
  }
}

export function getRankInfo(xp: number): { level: number; rankName: string; levelProgress: number } {
  const safeXp = safeInteger(xp)
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
  const comboXp = Math.max(0, summary.stats.peakCombo - 1) * 12
  const modeXp = summary.mode === 'arcade' ? 40 : 25
  const survivalXp = summary.stats.missedFruits === 0 && summary.stats.bombHits === 0 ? 20 : 0
  const xp = modeXp + scoreXp + comboXp + survivalXp

  const starfruitFromScore = Math.floor(summary.score / 70)
  const starfruitFromCombo = Math.max(0, summary.stats.peakCombo - 2)
  const flawlessBonus = summary.stats.missedFruits === 0 && summary.stats.bombHits === 0 ? 2 : 0
  const starfruit = starfruitFromScore + starfruitFromCombo + flawlessBonus

  return { xp, starfruit }
}

function applyObjectiveProgress(objective: RewardObjective, summary: RunSummary): RewardObjective {
  if (objective.metric === 'runs') {
    const progress = Math.min(objective.target, objective.progress + 1)
    return {
      ...objective,
      progress,
      completed: objective.completed || progress >= objective.target,
    }
  }

  if (objective.metric === 'max-combo') {
    const progress = Math.min(objective.target, Math.max(objective.progress, summary.stats.peakCombo))
    return {
      ...objective,
      progress,
      completed: objective.completed || progress >= objective.target,
    }
  }

  const progress = Math.min(objective.target, Math.max(objective.progress, summary.score))
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
  const noRewards = (status: RunRewards['status']): RunRewards => ({
    status, flawless: false, xpEarned: 0, starfruitEarned: 0, objectiveCompletions: [],
  })
  if (!validRunId(summary.runId)) return { profile, rewards: noRewards('ineligible') }
  if (profile.settledRunIds.includes(summary.runId)) {
    return { profile, rewards: noRewards('already-settled') }
  }
  const settledRunIds = [...profile.settledRunIds, summary.runId].slice(-SETTLED_RUN_HISTORY_LIMIT)
  const counts = [summary.score, summary.durationMs, ...Object.values(summary.stats)]
  const validValues = counts.every((value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER)
    && ['classic', 'arcade', 'zen'].includes(summary.mode)
    && Object.values(summary.stats).every(Number.isInteger)
  if (!validValues || summary.durationMs < MIN_REWARDED_RUN_DURATION_MS
    || summary.stats.fruitSliced < 1 || summary.score <= 0) {
    return { profile: { ...profile, settledRunIds }, rewards: noRewards('ineligible') }
  }
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

  const xpEarned = safeInteger(baseRewards.xp + bonusXp)
  const starfruitEarned = safeInteger(baseRewards.starfruit + bonusStarfruit)

  return {
    profile: {
      schemaVersion: REWARD_PROFILE_SCHEMA_VERSION,
      settledRunIds,
      xp: safeInteger(profile.xp + xpEarned),
      starfruit: safeInteger(profile.starfruit + starfruitEarned),
      totalRuns: safeInteger(profile.totalRuns + 1),
      totalScore: safeInteger(profile.totalScore + summary.score),
      bestCombo: Math.max(profile.bestCombo, summary.stats.peakCombo),
      bestScore: Math.max(profile.bestScore, summary.score),
      objectives,
    },
    rewards: {
      status: 'earned',
      flawless: summary.stats.missedFruits === 0 && summary.stats.bombHits === 0,
      xpEarned,
      starfruitEarned,
      objectiveCompletions,
    },
  }
}
