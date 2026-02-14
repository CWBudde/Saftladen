import type { GameState, PowerUpType } from '../types'
import {
  ARCADE_ROUND_DURATION_MS,
  ZEN_ROUND_DURATION_MS,
  DOUBLE_POINTS_POWER_UP_DURATION_MS,
  FREEZE_POWER_UP_DURATION_MS,
  FRENZY_POWER_UP_DURATION_MS,
} from './constants'

export type ModeSystemModifiers = {
  physicsDtScale: number
  spawnRateScale: number
  suppressBombSpawns: boolean
  scoreMultiplier: number
  roundEnded: boolean
}

const DEFAULT_MODIFIERS: ModeSystemModifiers = {
  physicsDtScale: 1,
  spawnRateScale: 1,
  suppressBombSpawns: false,
  scoreMultiplier: 1,
  roundEnded: false,
}

function clampToNonNegative(value: number): number {
  return Math.max(0, value)
}

export function isPowerUpActive(state: GameState, powerUp: PowerUpType): boolean {
  const timers = state.modeState.arcade.powerUpTimers
  if (powerUp === 'freeze') {
    return timers.freezeMs > 0
  }
  if (powerUp === 'frenzy') {
    return timers.frenzyMs > 0
  }
  return timers.doublePointsMs > 0
}

export function getActivePowerUps(state: GameState): PowerUpType[] {
  if (state.mode !== 'arcade') {
    return []
  }

  const active: PowerUpType[] = []
  if (isPowerUpActive(state, 'freeze')) {
    active.push('freeze')
  }
  if (isPowerUpActive(state, 'frenzy')) {
    active.push('frenzy')
  }
  if (isPowerUpActive(state, 'double-points')) {
    active.push('double-points')
  }
  return active
}

export function activatePowerUp(state: GameState, powerUp: PowerUpType): void {
  if (state.mode !== 'arcade') {
    return
  }

  const timers = state.modeState.arcade.powerUpTimers
  if (powerUp === 'freeze') {
    timers.freezeMs = Math.max(timers.freezeMs, FREEZE_POWER_UP_DURATION_MS)
    return
  }
  if (powerUp === 'frenzy') {
    timers.frenzyMs = Math.max(timers.frenzyMs, FRENZY_POWER_UP_DURATION_MS)
    return
  }
  timers.doublePointsMs = Math.max(timers.doublePointsMs, DOUBLE_POINTS_POWER_UP_DURATION_MS)
}

export function createInitialArcadeState() {
  return {
    roundDurationMs: ARCADE_ROUND_DURATION_MS,
    remainingMs: ARCADE_ROUND_DURATION_MS,
    powerUpTimers: {
      freezeMs: 0,
      frenzyMs: 0,
      doublePointsMs: 0,
    },
  }
}

export function createInitialZenState() {
  return {
    roundDurationMs: ZEN_ROUND_DURATION_MS,
    remainingMs: ZEN_ROUND_DURATION_MS,
  }
}

export function stepModeSystem(state: GameState, dtMs: number): ModeSystemModifiers {
  if (state.mode === 'arcade') {
    const arcade = state.modeState.arcade
    const timers = arcade.powerUpTimers
    arcade.remainingMs = clampToNonNegative(arcade.remainingMs - dtMs)
    timers.freezeMs = clampToNonNegative(timers.freezeMs - dtMs)
    timers.frenzyMs = clampToNonNegative(timers.frenzyMs - dtMs)
    timers.doublePointsMs = clampToNonNegative(timers.doublePointsMs - dtMs)

    const freezeActive = timers.freezeMs > 0
    const frenzyActive = timers.frenzyMs > 0
    const doublePointsActive = timers.doublePointsMs > 0

    return {
      physicsDtScale: freezeActive ? 0.45 : 1,
      spawnRateScale: frenzyActive ? 1.85 : freezeActive ? 0.72 : 1.25,
      suppressBombSpawns: frenzyActive,
      scoreMultiplier: doublePointsActive ? 2 : 1,
      roundEnded: arcade.remainingMs <= 0,
    }
  }

  if (state.mode === 'zen') {
    const zen = state.modeState.zen
    zen.remainingMs = clampToNonNegative(zen.remainingMs - dtMs)

    return {
      physicsDtScale: 1,
      spawnRateScale: 0.8,
      suppressBombSpawns: true,
      scoreMultiplier: 1,
      roundEnded: zen.remainingMs <= 0,
    }
  }

  return DEFAULT_MODIFIERS
}
