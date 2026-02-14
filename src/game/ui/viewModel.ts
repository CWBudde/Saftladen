import type { ActivePowerUp, GameMode, GamePhase, GameState } from '../types'

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
  bestScore: number
  strikesRemaining: number
  strikesMax: number
  elapsedMs: number
  arcadeRemainingMs: number
  zenRemainingMs: number
  activePowerUps: ActivePowerUp[]
}

export const UI_SETTINGS_STORAGE_KEY = 'saftladen.ui.settings'

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
    bestScore: state.score.best,
    strikesRemaining: state.strikes.remaining,
    strikesMax: state.strikes.max,
    elapsedMs: state.world.elapsedMs,
    arcadeRemainingMs: state.modeState.arcade.remainingMs,
    zenRemainingMs: state.modeState.zen.remainingMs,
    activePowerUps,
  }
}

export function areGameUiSnapshotsEqual(left: GameUiSnapshot, right: GameUiSnapshot): boolean {
  return (
    left.view === right.view &&
      left.phase === right.phase &&
      left.mode === right.mode &&
      left.score === right.score &&
      left.combo === right.combo &&
      left.bestScore === right.bestScore &&
      left.strikesRemaining === right.strikesRemaining &&
      left.strikesMax === right.strikesMax &&
      left.elapsedMs === right.elapsedMs &&
      left.arcadeRemainingMs === right.arcadeRemainingMs &&
      left.zenRemainingMs === right.zenRemainingMs &&
      left.activePowerUps.join('|') === right.activePowerUps.join('|')
  )
}

export function loadUiSettings(): UiSettings {
  try {
    const raw = globalThis.localStorage?.getItem(UI_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_UI_SETTINGS
    }

    const parsed = JSON.parse(raw) as Partial<UiSettings>
    return {
      musicVolume:
        typeof parsed.musicVolume === 'number' ? Math.min(1, Math.max(0, parsed.musicVolume)) : DEFAULT_UI_SETTINGS.musicVolume,
      sfxVolume:
        typeof parsed.sfxVolume === 'number' ? Math.min(1, Math.max(0, parsed.sfxVolume)) : DEFAULT_UI_SETTINGS.sfxVolume,
      sliceSensitivity:
        typeof parsed.sliceSensitivity === 'number'
          ? Math.min(2, Math.max(0.5, parsed.sliceSensitivity))
          : DEFAULT_UI_SETTINGS.sliceSensitivity,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : DEFAULT_UI_SETTINGS.reducedMotion,
    }
  } catch {
    return DEFAULT_UI_SETTINGS
  }
}

export function saveUiSettings(settings: UiSettings): void {
  try {
    globalThis.localStorage?.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore persistence failures in restricted runtimes.
  }
}
