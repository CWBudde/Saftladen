import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  BLADE_UNLOCKS,
  DOJO_UNLOCKS,
  getCosmeticUnlock,
  COSMETIC_SELECTION_STORAGE_KEY,
  DEFAULT_COSMETIC_SELECTION,
  loadCosmeticSelection,
  saveCosmeticSelection,
} from '../src/game/ui/cosmetics'
import {
  applyRunRewards,
  createDefaultRewardProfile,
  getRankInfo,
  loadRewardProfile,
  REWARD_PROFILE_STORAGE_KEY,
  saveRewardProfile,
  SETTLED_RUN_HISTORY_LIMIT,
} from '../src/game/ui/rewards'
import {
  DEFAULT_UI_SETTINGS,
  loadUiSettings,
  saveUiSettings,
  UI_SETTINGS_STORAGE_KEY,
} from '../src/game/ui/viewModel'

const savedDescriptors = new Map<string, PropertyDescriptor | undefined>()
let values: Map<string, string>

function replaceGlobal(name: string, value: unknown) {
  if (!savedDescriptors.has(name))
    savedDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, value })
}

beforeEach(() => {
  values = new Map()
  replaceGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
  replaceGlobal('matchMedia', () => ({ matches: false }))
})

afterEach(() => {
  for (const [name, descriptor] of savedDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  savedDescriptors.clear()
})

describe('reward profile migrations', () => {
  test('v2 migration preserves earned totals, settled runs and paid objectives without retroactive goal rewards', () => {
    const old = {
      ...createDefaultRewardProfile(),
      schemaVersion: 2,
      xp: 1120,
      starfruit: 110,
      totalRuns: 25,
      bestScore: 700,
      settledRunIds: ['old:1'],
      achievements: undefined,
      challenges: undefined,
    }
    old.objectives = old.objectives.map((goal) => ({
      ...goal,
      progress: goal.target,
      completed: true,
    }))
    values.set(REWARD_PROFILE_STORAGE_KEY, JSON.stringify(old))
    const profile = loadRewardProfile()
    expect(profile).toMatchObject({
      schemaVersion: 3,
      xp: 1120,
      starfruit: 110,
      totalRuns: 25,
      bestScore: 700,
      settledRunIds: ['old:1'],
      objectives: old.objectives,
    })
    expect(profile.achievements.every((goal) => !goal.completed && goal.progress === 0)).toBe(true)
    expect(profile.challenges.goals.every((goal) => goal.progress === 0)).toBe(true)
    expect(getCosmeticUnlock(BLADE_UNLOCKS[2], profile).unlocked).toBe(true)
    expect(getCosmeticUnlock(DOJO_UNLOCKS[2], profile).unlocked).toBe(true)
  })

  test('partial goals and paid challenge slots survive time away and duplicate settlement after reload', () => {
    let profile = createDefaultRewardProfile()
    const summary = {
      runId: 'board:paid',
      mode: 'arcade' as const,
      score: 100,
      durationMs: 60000,
      stats: {
        fruitSliced: 20,
        missedFruits: 1,
        bombHits: 1,
        peakCombo: 3,
        strokesAttempted: 15,
        successfulStrokes: 10,
        peakStrokeCombo: 3,
      },
    }
    profile = applyRunRewards(profile, summary).profile
    profile = applyRunRewards(profile, {
      ...summary,
      runId: 'board:partial',
      mode: 'zen',
      stats: { ...summary.stats, fruitSliced: 10 },
    }).profile
    saveRewardProfile(profile)
    // No timestamps enter this policy; old calendar fields cannot expire progress.
    const raw = JSON.parse(values.get(REWARD_PROFILE_STORAGE_KEY)!)
    raw.challenges.expiresAt = '2000-01-01'
    values.set(REWARD_PROFILE_STORAGE_KEY, JSON.stringify(raw))
    expect(loadRewardProfile()).toEqual(profile)
    expect(loadRewardProfile().challenges.goals.map((goal) => goal.progress)).toEqual([0, 20, 10])
    const repeated = applyRunRewards(loadRewardProfile(), summary)
    expect(repeated.rewards.status).toBe('already-settled')
    expect(repeated.profile).toEqual(profile)
  })

  test('new goal fields repair malformed siblings and retain completed achievements', () => {
    values.set(
      REWARD_PROFILE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 3,
        xp: 1120,
        starfruit: 110,
        achievements: [null, { id: 'zen-fruit', completed: true, rewardXp: 999999 }],
        challenges: {
          cycle: 2,
          goals: [
            false,
            { id: 'gesture-classic', progress: 2 },
            { id: 'gesture-zen', progress: -1 },
          ],
        },
      }),
    )
    const profile = loadRewardProfile()
    expect(profile.achievements.find((goal) => goal.id === 'zen-fruit')).toMatchObject({
      completed: true,
      progress: 40,
      rewardXp: 100,
    })
    expect(profile.challenges.goals.map((goal) => goal.progress)).toEqual([2, 0, 0])
    saveRewardProfile(profile)
    expect(loadRewardProfile()).toEqual(profile)
    expect(profile.xp).toBe(1120)
    expect(profile.starfruit).toBe(110)
  })

  test('legacy valid counters survive malformed objective siblings', () => {
    values.set(
      REWARD_PROFILE_STORAGE_KEY,
      JSON.stringify({
        xp: 621,
        starfruit: 48,
        totalRuns: 3,
        bestScore: 420,
        objectives: [
          null,
          false,
          5,
          { id: 'combo', progress: 4 },
          { id: 'score', progress: 350, completed: false },
        ],
      }),
    )
    const profile = loadRewardProfile()
    expect(profile.schemaVersion).toBe(3)
    expect(profile.xp).toBe(621)
    expect(profile.starfruit).toBe(48)
    expect(profile.totalRuns).toBe(3)
    expect(profile.bestScore).toBe(420)
    expect(profile.objectives.find((objective) => objective.id === 'combo')?.progress).toBe(4)
    expect(profile.objectives.find((objective) => objective.id === 'score')?.completed).toBe(true)
    expect(profile.settledRunIds).toEqual([])
    expect(getCosmeticUnlock(BLADE_UNLOCKS[1], profile).unlocked).toBe(true)
    expect(getCosmeticUnlock(DOJO_UNLOCKS[1], profile).unlocked).toBe(true)
    saveRewardProfile(profile)
    expect(loadRewardProfile()).toEqual(profile)
    expect(getCosmeticUnlock(BLADE_UNLOCKS[1], loadRewardProfile()).unlocked).toBe(true)
  })

  test('nonfinite, wrong-type and negative counters are repaired independently', () => {
    values.set(
      REWARD_PROFILE_STORAGE_KEY,
      '{"xp":1e309,"starfruit":42,"totalRuns":-7,"totalScore":"900","bestCombo":null,"bestScore":123.8}',
    )
    const profile = loadRewardProfile()
    expect(profile.xp).toBe(0)
    expect(profile.starfruit).toBe(42)
    expect(profile.totalRuns).toBe(0)
    expect(profile.totalScore).toBe(0)
    expect(profile.bestCombo).toBe(0)
    expect(profile.bestScore).toBe(123)
    expect(getRankInfo(Number.NaN)).toEqual({ level: 1, rankName: 'Novice', levelProgress: 0 })
  })

  test('saved objective metadata cannot change targets or payouts', () => {
    values.set(
      REWARD_PROFILE_STORAGE_KEY,
      JSON.stringify({
        objectives: [
          {
            id: 'combo',
            progress: 1,
            completed: true,
            target: 1,
            rewardXp: 999999,
            title: 'Changed',
          },
        ],
      }),
    )
    const objective = loadRewardProfile().objectives.find((entry) => entry.id === 'combo')!
    expect(objective.title).toBe('Streak Student')
    expect(objective.target).toBe(6)
    expect(objective.rewardXp).toBe(120)
    expect(objective.progress).toBe(6)
    expect(objective.completed).toBe(true)
  })

  test('settlement IDs are validated, deduplicated and bounded on load', () => {
    const ids = Array.from({ length: SETTLED_RUN_HISTORY_LIMIT + 2 }, (_, index) => `old:${index}`)
    values.set(
      REWARD_PROFILE_STORAGE_KEY,
      JSON.stringify({ settledRunIds: [null, '', ' ', 3, ...ids, ids[5]] }),
    )
    const profile = loadRewardProfile()
    expect(profile.settledRunIds).toHaveLength(SETTLED_RUN_HISTORY_LIMIT)
    expect(profile.settledRunIds[0]).toBe('old:2')
    expect(new Set(profile.settledRunIds).size).toBe(SETTLED_RUN_HISTORY_LIMIT)
  })

  test('settlement survives a page reload and cannot pay the same run twice', () => {
    const run = {
      runId: 'reload-safe:7',
      mode: 'zen' as const,
      score: 100,
      durationMs: 90000,
      stats: {
        fruitSliced: 7,
        missedFruits: 0,
        bombHits: 0,
        peakCombo: 3,
        strokesAttempted: 5,
        successfulStrokes: 4,
        peakStrokeCombo: 3,
      },
    }
    const first = applyRunRewards(createDefaultRewardProfile(), run)
    saveRewardProfile(first.profile)
    const loaded = loadRewardProfile()
    const repeated = applyRunRewards(loaded, run)
    expect(repeated.profile).toBe(loaded)
    expect(repeated.rewards.status).toBe('already-settled')
    expect(loaded.xp).toBe(first.profile.xp)
    expect(loaded.totalRuns).toBe(1)
    expect(JSON.parse(values.get(REWARD_PROFILE_STORAGE_KEY)!).schemaVersion).toBe(3)
  })
})

describe('settings migrations', () => {
  test('unversioned settings preserve each valid preference', () => {
    values.set(
      UI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        musicVolume: 0.25,
        sfxVolume: 0,
        sliceSensitivity: 1.4,
        reducedMotion: true,
      }),
    )
    expect(loadUiSettings()).toEqual({
      musicVolume: 0.25,
      sfxVolume: 0,
      sliceSensitivity: 1.4,
      reducedMotion: true,
    })
  })

  test('malformed preferences do not discard valid siblings', () => {
    values.set(
      UI_SETTINGS_STORAGE_KEY,
      '{"schemaVersion":1,"musicVolume":1e309,"sfxVolume":0.3,"sliceSensitivity":"fast","reducedMotion":true}',
    )
    expect(loadUiSettings()).toEqual({
      ...DEFAULT_UI_SETTINGS,
      sfxVolume: 0.3,
      reducedMotion: true,
    })
  })

  test('finite out-of-range values clamp to supported controls', () => {
    values.set(
      UI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ musicVolume: 10, sfxVolume: -2, sliceSensitivity: 0 }),
    )
    expect(loadUiSettings()).toEqual({
      musicVolume: 1,
      sfxVolume: 0,
      sliceSensitivity: 0.5,
      reducedMotion: false,
    })
  })

  test('OS motion preference fills missing values, while explicit false wins', () => {
    replaceGlobal('matchMedia', () => ({ matches: true }))
    expect(loadUiSettings().reducedMotion).toBe(true)
    values.set(UI_SETTINGS_STORAGE_KEY, JSON.stringify({ reducedMotion: false }))
    expect(loadUiSettings().reducedMotion).toBe(false)
  })

  test('saving writes versioned sanitized values without nonfinite numbers', () => {
    saveUiSettings({
      musicVolume: Number.NaN,
      sfxVolume: 2,
      sliceSensitivity: Number.POSITIVE_INFINITY,
      reducedMotion: true,
    })
    expect(JSON.parse(values.get(UI_SETTINGS_STORAGE_KEY)!)).toEqual({
      schemaVersion: 1,
      musicVolume: DEFAULT_UI_SETTINGS.musicVolume,
      sfxVolume: 1,
      sliceSensitivity: DEFAULT_UI_SETTINGS.sliceSensitivity,
      reducedMotion: true,
    })
    const profile = createDefaultRewardProfile()
    saveRewardProfile({ ...profile, xp: Number.POSITIVE_INFINITY, starfruit: 3 })
    expect(loadRewardProfile().xp).toBe(0)
    expect(loadRewardProfile().starfruit).toBe(3)
  })

  test.each(['{broken', 'null', '[]'])('invalid root %s returns usable defaults', (raw) => {
    values.set(UI_SETTINGS_STORAGE_KEY, raw)
    values.set(REWARD_PROFILE_STORAGE_KEY, raw)
    expect(loadUiSettings()).toEqual(DEFAULT_UI_SETTINGS)
    expect(loadRewardProfile()).toEqual(createDefaultRewardProfile())
  })

  test('blocked storage and unavailable media queries leave the game usable', () => {
    replaceGlobal('localStorage', {
      getItem: () => {
        throw new Error('Storage blocked')
      },
      setItem: () => {
        throw new Error('Storage full')
      },
    })
    replaceGlobal('matchMedia', () => {
      throw new Error('Unavailable')
    })
    expect(loadUiSettings()).toEqual(DEFAULT_UI_SETTINGS)
    expect(loadRewardProfile()).toEqual(createDefaultRewardProfile())
    expect(() => saveUiSettings(DEFAULT_UI_SETTINGS)).not.toThrow()
    expect(() => saveRewardProfile(createDefaultRewardProfile())).not.toThrow()
  })
})

describe('equipment persistence', () => {
  const earned = { ...createDefaultRewardProfile(), xp: 1120, starfruit: 110 }

  test('old profiles start with usable equipment and keep all earned progress', () => {
    saveRewardProfile(earned)
    expect(loadCosmeticSelection(loadRewardProfile())).toEqual(DEFAULT_COSMETIC_SELECTION)
    expect(loadRewardProfile()).toEqual(earned)
  })

  test('both slots survive reload without spending or changing the reward save', () => {
    saveRewardProfile(earned)
    const rewardSave = values.get(REWARD_PROFILE_STORAGE_KEY)
    saveCosmeticSelection({ blade: 'dragon-fang', dojo: 'storm-temple' }, earned)
    expect(loadCosmeticSelection(loadRewardProfile())).toEqual({
      blade: 'dragon-fang',
      dojo: 'storm-temple',
    })
    expect(JSON.parse(values.get(COSMETIC_SELECTION_STORAGE_KEY)!)).toEqual({
      schemaVersion: 1,
      blade: 'dragon-fang',
      dojo: 'storm-temple',
    })
    expect(values.get(REWARD_PROFILE_STORAGE_KEY)).toBe(rewardSave)
  })

  test.each(['{broken', 'null', '[]', '42'])(
    'invalid equipment root %s falls back safely',
    (raw) => {
      values.set(COSMETIC_SELECTION_STORAGE_KEY, raw)
      expect(loadCosmeticSelection(earned)).toEqual(DEFAULT_COSMETIC_SELECTION)
    },
  )

  test('invalid IDs and unearned items repair independently of a valid sibling', () => {
    values.set(
      COSMETIC_SELECTION_STORAGE_KEY,
      JSON.stringify({ blade: 'retired-blade', dojo: 'storm-temple' }),
    )
    expect(loadCosmeticSelection(earned)).toEqual({ blade: 'bamboo', dojo: 'storm-temple' })
    values.set(
      COSMETIC_SELECTION_STORAGE_KEY,
      JSON.stringify({ blade: 'comet', dojo: 'storm-temple' }),
    )
    const early = { ...createDefaultRewardProfile(), starfruit: 40 }
    expect(loadCosmeticSelection(early)).toEqual({ blade: 'comet', dojo: 'great-wave' })
    saveCosmeticSelection({ blade: 'dragon-fang', dojo: 'sunset-harbor' }, early)
    expect(loadCosmeticSelection(early)).toEqual(DEFAULT_COSMETIC_SELECTION)
  })

  test('blocked storage retains session usability', () => {
    replaceGlobal('localStorage', {
      getItem: () => {
        throw new Error('Blocked')
      },
      setItem: () => {
        throw new Error('Full')
      },
    })
    expect(loadCosmeticSelection(earned)).toEqual(DEFAULT_COSMETIC_SELECTION)
    expect(() =>
      saveCosmeticSelection({ blade: 'comet', dojo: 'sunset-harbor' }, earned),
    ).not.toThrow()
  })
})
