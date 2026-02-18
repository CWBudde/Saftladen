import { resetEntityIds } from '../model'
import { applyCoreSystems, createInitialArcadeState, createInitialZenState } from '../systems'
import type { EntityId, GameEntity, GameMode, GameState, SliceTrail, TimeScalePreset } from '../types'
import { transitionGamePhase } from './phaseMachine'
import { createSeededRng } from './rng'

export const TIME_SCALE_FACTORS: Record<TimeScalePreset, number> = {
  normal: 1,
  slow: 0.5,
  freeze: 0,
}

const DEFAULT_FIXED_DT_MS = 1000 / 60
const DEFAULT_MAX_FRAME_DELTA_MS = 100
const MAX_FIXED_STEPS_PER_ADVANCE = 12
const DEFAULT_COMBO_WINDOW_MS = 320
const DEFAULT_STRIKES = 3
const BEST_SCORE_STORAGE_KEY_PREFIX = 'saftladen.bestScore.'

type EngineOptions = {
  seed?: number
  fixedDtMs?: number
  maxFrameDeltaMs?: number
  mode?: GameMode
}

type StartOptions = {
  seed?: number
}

type ResetOptions = {
  seed?: number
}

export type EngineDiagnostics = {
  accumulatorMs: number
  lastAdvanceSteps: number
}

export type GameEngine = {
  getState: () => Readonly<GameState>
  getDiagnostics: () => EngineDiagnostics
  setInputTrails: (trails: SliceTrail[]) => void
  setMode: (mode: GameMode) => void
  start: (options?: StartOptions) => void
  pause: () => void
  resume: () => void
  stop: () => void
  reset: (options?: ResetOptions) => void
  markGameOver: () => void
  setTimeScalePreset: (preset: TimeScalePreset) => void
  advanceBy: (deltaMs: number) => number
  stepOnce: (dtMs?: number) => void
  subscribe: (listener: (state: Readonly<GameState>) => void) => () => void
}

function emptyEntities(): Record<EntityId, GameEntity> {
  return {} as Record<EntityId, GameEntity>
}

function getBestScoreStorageKey(mode: GameMode): string {
  return `${BEST_SCORE_STORAGE_KEY_PREFIX}${mode}`
}

function loadBestScore(mode: GameMode): number {
  try {
    const raw = globalThis.localStorage?.getItem(getBestScoreStorageKey(mode))
    const parsed = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  } catch {
    return 0
  }
}

function saveBestScore(mode: GameMode, bestScore: number): void {
  try {
    globalThis.localStorage?.setItem(getBestScoreStorageKey(mode), String(bestScore))
  } catch {
    // Ignore persistence failures in restricted runtimes.
  }
}

function createBaseState(
  mode: GameMode,
  seed: number,
  fixedDtMs: number,
  maxFrameDeltaMs: number,
  bestScore = 0,
): GameState {
  return {
    mode,
    phase: 'idle',
    settings: {
      fixedDtMs,
      maxFrameDeltaMs,
      timeScale: {
        preset: 'normal',
        factor: TIME_SCALE_FACTORS.normal,
      },
    },
    score: {
      current: 0,
      combo: 0,
      best: bestScore,
      comboWindowMs: DEFAULT_COMBO_WINDOW_MS,
      lastSliceAtMs: null,
    },
    strikes: {
      max: DEFAULT_STRIKES,
      remaining: DEFAULT_STRIKES,
      lastStrikeAtMs: null,
    },
    world: {
      tick: 0,
      elapsedMs: 0,
      bounds: {
        x: 1280,
        y: 720,
      },
      entities: emptyEntities(),
      spawn: {
        nextWaveAtMs: 0,
        wavesSpawned: 0,
        pending: [],
      },
      misses: {
        count: 0,
        lastMissedFruitId: null,
        lastMissedAtMs: null,
      },
      sliceEvents: [],
      scoreFeedbackEvents: [],
      nextScoreFeedbackId: 1,
      lastBombHitAtMs: null,
    },
    run: {
      seed,
      rngCalls: 0,
      simulationSteps: 0,
    },
    modeState: {
      arcade: createInitialArcadeState(),
      zen: createInitialZenState(),
    },
  }
}

export function createGameEngine(options: EngineOptions = {}): GameEngine {
  const fixedDtMs = options.fixedDtMs ?? DEFAULT_FIXED_DT_MS
  const maxFrameDeltaMs = options.maxFrameDeltaMs ?? DEFAULT_MAX_FRAME_DELTA_MS
  const mode = options.mode ?? 'classic'
  const initialSeed = options.seed ?? Date.now()
  const rng = createSeededRng(initialSeed)
  const persistedBestScore = loadBestScore(mode)

  let state = createBaseState(mode, rng.getSeed(), fixedDtMs, maxFrameDeltaMs, persistedBestScore)
  let accumulatorMs = 0
  let lastAdvanceSteps = 0
  let inputTrails: SliceTrail[] = []
  const listeners = new Set<(state: Readonly<GameState>) => void>()

  const emit = () => {
    listeners.forEach((listener) => listener(state))
  }

  const reseedRun = (seed: number) => {
    rng.reseed(seed)
    state.run.seed = rng.getSeed()
    state.run.rngCalls = 0
  }

  const resetRunState = (seed: number) => {
    const bestScore = state.score.best
    state = createBaseState(
      state.mode,
      seed,
      state.settings.fixedDtMs,
      state.settings.maxFrameDeltaMs,
      bestScore,
    )
    state.run.seed = seed
    accumulatorMs = 0
    lastAdvanceSteps = 0
    inputTrails = []
    resetEntityIds(1)
  }

  const transition = (event: 'start' | 'pause' | 'resume' | 'stop' | 'reset' | 'game-over') => {
    const nextPhase = transitionGamePhase(state.phase, event)
    state.phase = nextPhase
  }

  const runSimulationStep = (dtMs: number) => {
    state.world.tick += 1
    state.world.elapsedMs += dtMs
    state.run.simulationSteps += 1
    const outcome = applyCoreSystems(
      state,
      dtMs,
      {
        nextFloat: rng.nextFloat,
        nextInt: rng.nextInt,
      },
      inputTrails,
    )

    if (outcome.missedFruits > 0 && state.mode === 'classic') {
      state.strikes.remaining = Math.max(0, state.strikes.remaining - outcome.missedFruits)
      state.strikes.lastStrikeAtMs = state.world.elapsedMs
    }

    if (state.phase === 'running') {
      if (state.mode === 'classic' && (outcome.bombHit || state.strikes.remaining <= 0)) {
        if (outcome.bombHit) {
          state.world.lastBombHitAtMs = state.world.elapsedMs
        }
        transition('game-over')
      }

      if (state.mode === 'arcade' && outcome.roundEnded) {
        transition('game-over')
      }
    }

    if (state.score.current > state.score.best) {
      state.score.best = state.score.current
      saveBestScore(state.mode, state.score.best)
    }

    state.run.rngCalls = rng.getCalls()
  }

  const setInputTrails = (trails: SliceTrail[]) => {
    inputTrails = trails.map((trail) => ({
      pointerId: trail.pointerId,
      points: trail.points.map((point) => ({
        x: point.x,
        y: point.y,
        tMs: point.tMs,
      })),
    }))
  }

  const setMode = (nextMode: GameMode) => {
    if (state.mode === nextMode) {
      return
    }

    const seed = state.run.seed
    const bestScore = loadBestScore(nextMode)
    state = createBaseState(
      nextMode,
      seed,
      state.settings.fixedDtMs,
      state.settings.maxFrameDeltaMs,
      bestScore,
    )
    state.run.seed = seed
    accumulatorMs = 0
    lastAdvanceSteps = 0
    inputTrails = []
    resetEntityIds(1)
    emit()
  }

  const start = (startOptions: StartOptions = {}) => {
    const nextPhase = transitionGamePhase(state.phase, 'start')
    if (nextPhase !== 'running') {
      return
    }

    const seed = startOptions.seed ?? state.run.seed
    reseedRun(seed)
    resetRunState(seed)
    transition('start')
    emit()
  }

  const pause = () => {
    transition('pause')
    emit()
  }

  const resume = () => {
    transition('resume')
    emit()
  }

  const stop = () => {
    transition('stop')
    accumulatorMs = 0
    lastAdvanceSteps = 0
    emit()
  }

  const reset = (resetOptions: ResetOptions = {}) => {
    const seed = resetOptions.seed ?? Date.now()
    reseedRun(seed)
    resetRunState(seed)
    transition('reset')
    emit()
  }

  const markGameOver = () => {
    transition('game-over')
    emit()
  }

  const setTimeScalePreset = (preset: TimeScalePreset) => {
    state.settings.timeScale = {
      preset,
      factor: TIME_SCALE_FACTORS[preset],
    }
    emit()
  }

  const stepOnce = (dtMs = state.settings.fixedDtMs) => {
    if (state.phase !== 'running') {
      return
    }

    runSimulationStep(dtMs)
    emit()
  }

  const advanceBy = (deltaMs: number) => {
    if (state.phase !== 'running') {
      lastAdvanceSteps = 0
      return 0
    }

    if (!Number.isFinite(deltaMs)) {
      return 0
    }

    // Hard clamp large frame deltas (tab switches/background throttling) to avoid huge catch-up bursts.
    const clampedDeltaMs = Math.min(Math.max(deltaMs, 0), state.settings.maxFrameDeltaMs)
    const scaledDeltaMs = clampedDeltaMs * state.settings.timeScale.factor
    accumulatorMs += scaledDeltaMs

    let steps = 0
    while (accumulatorMs >= state.settings.fixedDtMs && steps < MAX_FIXED_STEPS_PER_ADVANCE) {
      runSimulationStep(state.settings.fixedDtMs)
      accumulatorMs -= state.settings.fixedDtMs
      steps += 1
    }

    // Extra safety: if we're still far behind after step cap, drop backlog to prevent spiral-of-death.
    if (steps === MAX_FIXED_STEPS_PER_ADVANCE && accumulatorMs >= state.settings.fixedDtMs) {
      accumulatorMs = accumulatorMs % state.settings.fixedDtMs
    }

    lastAdvanceSteps = steps
    emit()
    return steps
  }

  const subscribe = (listener: (currentState: Readonly<GameState>) => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    getState: () => state,
    getDiagnostics: () => ({
      accumulatorMs,
      lastAdvanceSteps,
    }),
    setInputTrails,
    setMode,
    start,
    pause,
    resume,
    stop,
    reset,
    markGameOver,
    setTimeScalePreset,
    advanceBy,
    stepOnce,
    subscribe,
  }
}
