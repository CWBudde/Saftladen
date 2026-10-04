import type { ActivePowerUp, GameMode, GamePhase, GameState, RunStats } from '../types'

export type UiView = 'menu' | 'playing' | 'paused' | 'game-over'

export type UiSettings = {
  musicVolume: number
  sfxVolume: number
  sliceSensitivity: number
  reducedMotion: boolean
}

export type GameUiSnapshot = {
  view: UiView
  phase: GamePhase
  mode: GameMode
  score: number
  combo: number
  streakMultiplier: number
  strokeCombo: number
  bestScore: number
  strikesRemaining: number
  strikesMax: number
  elapsedMs: number
  arcadeRemainingMs: number
  zenRemainingMs: number
  activePowerUps: ActivePowerUp[]
  powerUpRemainingMs: Record<ActivePowerUp, number>
  runId: string
  stats: RunStats
}

export const UI_SETTINGS_STORAGE_KEY = 'saftladen.ui.settings'
export const UI_SETTINGS_SCHEMA_VERSION = 1

export const DEFAULT_UI_SETTINGS: UiSettings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  sliceSensitivity: 1,
  reducedMotion: false,
}

export function mapPhaseToView(phase: GamePhase): UiView {
  switch (phase) {
    case 'running':
      return 'playing'
    case 'paused':
      return 'paused'
    case 'game-over':
      return 'game-over'
    case 'idle':
    default:
      return 'menu'
  }
}

export function selectGameUiSnapshot(state: Readonly<GameState>): GameUiSnapshot {
  const activePowerUps: ActivePowerUp[] = []
  const timers = state.modeState.arcade.powerUpTimers
  if (timers.freezeMs > 0) {
    activePowerUps.push('freeze')
  }
  if (timers.frenzyMs > 0) {
    activePowerUps.push('frenzy')
  }
  if (timers.doublePointsMs > 0) {
    activePowerUps.push('double-points')
  }

  return {
    view: mapPhaseToView(state.phase),
    phase: state.phase,
    mode: state.mode,
    score: state.score.current,
    combo: state.score.combo,
    streakMultiplier: state.score.streakMultiplier,
    strokeCombo: state.score.strokeCombo,
    bestScore: state.score.best,
    strikesRemaining: state.strikes.remaining,
    strikesMax: state.strikes.max,
    elapsedMs: state.world.elapsedMs,
    arcadeRemainingMs: state.modeState.arcade.remainingMs,
    zenRemainingMs: state.modeState.zen.remainingMs,
    activePowerUps,
    powerUpRemainingMs: {
      freeze: timers.freezeMs,
      frenzy: timers.frenzyMs,
      'double-points': timers.doublePointsMs,
    },
    runId: state.run.id,
    stats: { ...state.run.stats },
  }
}

export function areGameUiSnapshotsEqual(left: GameUiSnapshot, right: GameUiSnapshot): boolean {
  return (
    left.view === right.view &&
    left.runId === right.runId &&
    left.stats.fruitSliced === right.stats.fruitSliced &&
    left.stats.missedFruits === right.stats.missedFruits &&
    left.stats.bombHits === right.stats.bombHits &&
    left.stats.peakCombo === right.stats.peakCombo &&
    left.stats.strokesAttempted === right.stats.strokesAttempted &&
    left.stats.successfulStrokes === right.stats.successfulStrokes &&
    left.stats.peakStrokeCombo === right.stats.peakStrokeCombo &&
    Math.ceil(left.powerUpRemainingMs.freeze / 1000) ===
      Math.ceil(right.powerUpRemainingMs.freeze / 1000) &&
    Math.ceil(left.powerUpRemainingMs.frenzy / 1000) ===
      Math.ceil(right.powerUpRemainingMs.frenzy / 1000) &&
    Math.ceil(left.powerUpRemainingMs['double-points'] / 1000) ===
      Math.ceil(right.powerUpRemainingMs['double-points'] / 1000) &&
    left.phase === right.phase &&
    left.mode === right.mode &&
    left.score === right.score &&
    left.combo === right.combo &&
    left.streakMultiplier === right.streakMultiplier &&
    left.strokeCombo === right.strokeCombo &&
    left.bestScore === right.bestScore &&
    left.strikesRemaining === right.strikesRemaining &&
    left.strikesMax === right.strikesMax &&
    // Elapsed time rounds down; countdowns round up. Phase changes publish exact run times.
    Math.floor(left.elapsedMs / 1000) === Math.floor(right.elapsedMs / 1000) &&
    Math.ceil(left.arcadeRemainingMs / 1000) === Math.ceil(right.arcadeRemainingMs / 1000) &&
    Math.ceil(left.zenRemainingMs / 1000) === Math.ceil(right.zenRemainingMs / 1000) &&
    left.activePowerUps.length === right.activePowerUps.length &&
    left.activePowerUps.every((powerUp, index) => powerUp === right.activePowerUps[index])
  )
}

function defaultUiSettings(): UiSettings {
  let reducedMotion = DEFAULT_UI_SETTINGS.reducedMotion
  try {
    reducedMotion =
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? reducedMotion
  } catch {
    // Use the default when the host does not provide media queries.
  }
  return { ...DEFAULT_UI_SETTINGS, reducedMotion }
}

function normalizeUiSettings(value: unknown): UiSettings {
  const defaults = defaultUiSettings()
  const parsed =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const ranged = (value: unknown, minimum: number, maximum: number, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(maximum, Math.max(minimum, value))
      : fallback
  return {
    musicVolume: ranged(parsed.musicVolume, 0, 1, defaults.musicVolume),
    sfxVolume: ranged(parsed.sfxVolume, 0, 1, defaults.sfxVolume),
    sliceSensitivity: ranged(parsed.sliceSensitivity, 0.5, 2, defaults.sliceSensitivity),
    reducedMotion:
      typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaults.reducedMotion,
  }
}

/** Version 1 keeps the original field names, preserving unversioned preferences. */
export function loadUiSettings(): UiSettings {
  try {
    const raw = globalThis.localStorage?.getItem(UI_SETTINGS_STORAGE_KEY)
    return raw ? normalizeUiSettings(JSON.parse(raw)) : defaultUiSettings()
  } catch {
    return defaultUiSettings()
  }
}

export function saveUiSettings(settings: UiSettings): void {
  try {
    globalThis.localStorage?.setItem(
      UI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: UI_SETTINGS_SCHEMA_VERSION,
        ...normalizeUiSettings(settings),
      }),
    )
  } catch {
    // Ignore persistence failures in restricted runtimes.
  }
}
