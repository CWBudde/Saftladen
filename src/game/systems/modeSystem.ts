import type { GameState, PowerUpType, PresentationEventPayload } from '../types'
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
    // Frenzy is a hazard-free window, including bombs already launched or queued.
    // Retiring hazards is not a hit and produces no score, statistic or audio event.
    for (const entity of Object.values(state.world.entities)) {
      if (entity.kind === 'bomb') delete state.world.entities[entity.id]
    }
    state.world.spawn.pending = state.world.spawn.pending.filter(
      (entry) => entry.entity.kind !== 'bomb',
    )
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

export function stepModeSystem(
  state: GameState,
  dtMs: number,
  events?: PresentationEventPayload[],
): ModeSystemModifiers {
  if (state.mode === 'arcade') {
    const arcade = state.modeState.arcade
    const timers = arcade.powerUpTimers
    const activeBeforeStep = getActivePowerUps(state)
    arcade.remainingMs = clampToNonNegative(arcade.remainingMs - dtMs)
    timers.freezeMs = clampToNonNegative(timers.freezeMs - dtMs)
    timers.frenzyMs = clampToNonNegative(timers.frenzyMs - dtMs)
    timers.doublePointsMs = clampToNonNegative(timers.doublePointsMs - dtMs)
    for (const powerUp of activeBeforeStep) {
      if (!isPowerUpActive(state, powerUp))
        events?.push({ type: 'power-up-expired', atMs: state.world.elapsedMs, powerUp })
    }
  } else if (state.mode === 'zen') {
    state.modeState.zen.remainingMs = clampToNonNegative(state.modeState.zen.remainingMs - dtMs)
  }
  return getModeModifiers(state)
}

/** Read modifiers without advancing any clock; useful after same-step pickups. */
export function getModeModifiers(state: GameState): ModeSystemModifiers {
  if (state.mode === 'arcade') {
    const { powerUpTimers: timers, remainingMs } = state.modeState.arcade
    const freezeActive = timers.freezeMs > 0
    const frenzyActive = timers.frenzyMs > 0
    return {
      physicsDtScale: freezeActive ? 0.45 : 1,
      spawnRateScale: frenzyActive ? 1.85 : freezeActive ? 0.72 : 1.25,
      suppressBombSpawns: frenzyActive,
      scoreMultiplier: timers.doublePointsMs > 0 ? 2 : 1,
      roundEnded: remainingMs <= 0,
    }
  }
  if (state.mode === 'zen') {
    return {
      physicsDtScale: 1,
      spawnRateScale: 0.8,
      suppressBombSpawns: true,
      scoreMultiplier: 1,
      roundEnded: state.modeState.zen.remainingMs <= 0,
    }
  }
  return { ...DEFAULT_MODIFIERS }
}
