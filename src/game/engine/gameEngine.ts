import { createEntityIdAllocator } from '../model'
import { applyCoreSystems, createInitialArcadeState, createInitialZenState } from '../systems'
import type { EntityId, GameEntity, GameMode, GamePresentationEvent, GameState, PresentationEventPayload, SliceTrail, ScoringConfig, TimeScalePreset, Vec2 } from '../types'
import { transitionGamePhase } from './phaseMachine'
import { createSeededRng } from './rng'
import { resizeWorld } from './resizeWorld'
import { DEFAULT_SCORING } from '../systems/constants'

export const TIME_SCALE_FACTORS: Record<TimeScalePreset, number> = {
  normal: 1,
  slow: 0.5,
  freeze: 0,
}

const DEFAULT_FIXED_DT_MS = 1000 / 60
const DEFAULT_MAX_FRAME_DELTA_MS = 100
const MAX_FIXED_STEPS_PER_ADVANCE = 12
const DEFAULT_STRIKES = 3
const BEST_SCORE_STORAGE_KEY_PREFIX = 'saftladen.bestScore.'

type EngineOptions = {
  seed?: number
  fixedDtMs?: number
  maxFrameDeltaMs?: number
  mode?: GameMode
  effectsEnabled?: boolean
  scoring?: Partial<ScoringConfig>
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
  clearInputTrails: (pointerId?: number) => void
  setMode: (mode: GameMode) => void
  setWorldBounds: (bounds: Vec2) => void
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
  subscribeEvents: (listener: (events: readonly GamePresentationEvent[]) => void) => () => void
}

let nextEngineIdentity = 1

function freezeEvent<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeEvent)
    Object.freeze(value)
  }
  return value
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
  bounds: Vec2 = { x: 1280, y: 720 },
  scoring: ScoringConfig = { ...DEFAULT_SCORING },
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
      scoring: { ...scoring },
      strokes: {},
      streakMultiplier: 1,
      strokeCombo: 0,
      current: 0,
      combo: 0,
      best: bestScore,
      comboWindowMs: scoring.streakWindowMs,
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
      bounds: { ...bounds },
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
      id: '',
      seed,
      rngCalls: 0,
      simulationSteps: 0,
      cosmeticRngCalls: 0,
      stats: { fruitSliced: 0, missedFruits: 0, bombHits: 0, peakCombo: 0, strokesAttempted: 0, successfulStrokes: 0, peakStrokeCombo: 0 },
    },
    modeState: {
      arcade: createInitialArcadeState(),
      zen: createInitialZenState(),
    },
  }
}

export function createGameEngine(options: EngineOptions = {}): GameEngine {
  const scoring: ScoringConfig = { ...DEFAULT_SCORING }
  for (const key of Object.keys(scoring) as (keyof ScoringConfig)[]) {
    const value = options.scoring?.[key]
    if (value !== undefined && Number.isFinite(value) && value >= 0) scoring[key] = Math.min(value, 1_000_000)
  }
  scoring.strokeComboMinimum = Math.max(3, Math.floor(scoring.strokeComboMinimum))
  scoring.streakFruitInterval = Math.max(1, Math.floor(scoring.streakFruitInterval))
  scoring.maxStreakMultiplier = Math.min(100, Math.max(1, scoring.maxStreakMultiplier))
  const fixedDtMs = options.fixedDtMs ?? DEFAULT_FIXED_DT_MS
  const maxFrameDeltaMs = options.maxFrameDeltaMs ?? DEFAULT_MAX_FRAME_DELTA_MS
  const mode = options.mode ?? 'classic'
  const initialSeed = options.seed ?? Date.now()
  const rng = createSeededRng(initialSeed)
  const cosmeticRng = createSeededRng(initialSeed ^ 0x9e3779b9)
  const gameplayIds = createEntityIdAllocator()
  const cosmeticIds = createEntityIdAllocator(-1, -1)
  const engineIdentity = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${nextEngineIdentity++}-${Math.random().toString(36).slice(2)}`
  let nextRunNumber = 1
  let nextEventId = 1
  const persistedBestScore = loadBestScore(mode)
  let lastSavedBestScore = persistedBestScore

  let state = createBaseState(mode, rng.getSeed(), fixedDtMs, maxFrameDeltaMs, persistedBestScore, undefined, scoring)
  let accumulatorMs = 0
  let lastAdvanceSteps = 0
  let inputTrails: SliceTrail[] = []
  let nextLegacyStrokeId = -1
  const listeners = new Set<(state: Readonly<GameState>) => void>()
  const eventListeners = new Set<(events: readonly GamePresentationEvent[]) => void>()
  let pendingEvents: GamePresentationEvent[] = []

  const queueEvents = (events: PresentationEventPayload[]) => {
    for (const event of events) pendingEvents.push(freezeEvent({ ...event, id: nextEventId++, runId: state.run.id }))
  }

  const emit = () => {
    if (pendingEvents.length > 0) {
      const batch = Object.freeze(pendingEvents)
      pendingEvents = []
      eventListeners.forEach((listener) => listener(batch))
    }
    listeners.forEach((listener) => listener(state))
  }

  const persistBestScore = () => {
    if (state.score.best > lastSavedBestScore) {
      saveBestScore(state.mode, state.score.best)
      lastSavedBestScore = state.score.best
    }
  }

  const reseedRun = (seed: number) => {
    rng.reseed(seed)
    cosmeticRng.reseed(seed ^ 0x9e3779b9)
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
      state.world.bounds,
      scoring,
    )
    state.run.seed = seed
    accumulatorMs = 0
    lastAdvanceSteps = 0
    inputTrails = []
    nextLegacyStrokeId = -1
    gameplayIds.reset()
    cosmeticIds.reset()
  }

  const transition = (event: 'start' | 'pause' | 'resume' | 'stop' | 'reset' | 'game-over') => {
    const previousPhase = state.phase
    const nextPhase = transitionGamePhase(state.phase, event)
    if (nextPhase !== state.phase) {
      inputTrails = []
      state.score.strokes = {}
      state.score.strokeCombo = 0
      accumulatorMs = 0
    }
    state.phase = nextPhase
    if (nextPhase === 'game-over' && nextPhase !== previousPhase) {
      queueEvents([{ type: 'run-end', atMs: state.world.elapsedMs, mode: state.mode, score: state.score.current, durationMs: state.world.elapsedMs, peakCombo: state.run.stats.peakCombo, stats: { ...state.run.stats } }])
    }
  }

  const runSimulationStep = (dtMs: number) => {
    if (state.mode === 'arcade') dtMs = Math.min(dtMs, state.modeState.arcade.remainingMs)
    if (state.mode === 'zen') dtMs = Math.min(dtMs, state.modeState.zen.remainingMs)
    state.world.tick += 1
    state.world.elapsedMs += dtMs
    state.run.simulationSteps += 1
    const stepTrails = inputTrails
    inputTrails = []
    for (const trail of stepTrails) {
      if (trail.strokeId === undefined || !trail.points.some((point, index) => index > 0 && (point.x !== trail.points[index - 1].x || point.y !== trail.points[index - 1].y)) || state.score.strokes[trail.strokeId]) continue
      // Native input has only a handful of pointers. Bound malformed/headless streams too.
      const ids = Object.keys(state.score.strokes)
      if (ids.length >= 128) delete state.score.strokes[Number(ids[0])]
      state.score.strokes[trail.strokeId] = { pointerId: trail.pointerId, fruitCount: 0, bonusAwarded: 0, blocked: false }
      state.run.stats.strokesAttempted += 1
      state.score.strokeCombo = 0
    }
    const stepEvents: PresentationEventPayload[] = []
    const outcome = applyCoreSystems(
      state,
      dtMs,
      {
        nextFloat: rng.nextFloat,
        nextInt: rng.nextInt,
      },
      stepTrails,
      {
        cosmeticRandom: cosmeticRng,
        nextGameplayId: gameplayIds.next,
        nextCosmeticId: cosmeticIds.next,
        events: stepEvents,
        effectsEnabled: options.effectsEnabled ?? true,
      },
    )
    for (const trail of stepTrails) {
      if (trail.ended && trail.strokeId !== undefined) delete state.score.strokes[trail.strokeId]
    }
    queueEvents(stepEvents)

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

      if (state.mode !== 'classic' && outcome.roundEnded) {
        transition('game-over')
      }
    }

    if (state.score.current > state.score.best) {
      state.score.best = state.score.current
    }

    state.run.rngCalls = rng.getCalls()
    state.run.cosmeticRngCalls = cosmeticRng.getCalls()
  }

  const setInputTrails = (trails: SliceTrail[]) => {
    if (state.phase !== 'running' || state.settings.timeScale.factor === 0) return
    inputTrails.push(...trails.slice().sort((left, right) => left.pointerId - right.pointerId || (left.points[0]?.tMs ?? 0) - (right.points[0]?.tMs ?? 0)).map((trail) => ({
      pointerId: trail.pointerId,
      strokeId: trail.strokeId ?? nextLegacyStrokeId--,
      ended: trail.ended ?? trail.strokeId === undefined,
      points: trail.points.map((point) => ({
        x: point.x,
        y: point.y,
        tMs: point.tMs,
      })),
    })))
  }

  const setMode = (nextMode: GameMode) => {
    if (state.mode === nextMode) {
      return
    }

    const seed = state.run.seed
    const bestScore = loadBestScore(nextMode)
    lastSavedBestScore = bestScore
    state = createBaseState(
      nextMode,
      seed,
      state.settings.fixedDtMs,
      state.settings.maxFrameDeltaMs,
      bestScore,
      state.world.bounds,
      scoring,
    )
    state.run.seed = seed
    accumulatorMs = 0
    lastAdvanceSteps = 0
    inputTrails = []
    nextLegacyStrokeId = -1
    gameplayIds.reset()
    cosmeticIds.reset()
    emit()
  }

  const start = (startOptions: StartOptions = {}) => {
    const nextPhase = transitionGamePhase(state.phase, 'start')
    if (nextPhase !== 'running' || state.phase === 'running') {
      return
    }

    const seed = startOptions.seed ?? state.run.seed
    reseedRun(seed)
    resetRunState(seed)
    state.run.id = `${engineIdentity}:${nextRunNumber++}`
    transition('start')
    queueEvents([{ type: 'run-start', atMs: 0, mode: state.mode, seed: state.run.seed }])
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
    inputTrails = []
    state.score.strokes = {}
    state.score.strokeCombo = 0
    state.settings.timeScale = {
      preset,
      factor: TIME_SCALE_FACTORS[preset],
    }
    emit()
  }

  const stepOnce = (dtMs = state.settings.fixedDtMs) => {
    if (state.phase !== 'running' || !Number.isFinite(dtMs) || dtMs <= 0) {
      return
    }

    runSimulationStep(dtMs)
    persistBestScore()
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
    while (state.phase === 'running' && accumulatorMs >= state.settings.fixedDtMs && steps < MAX_FIXED_STEPS_PER_ADVANCE) {
      accumulatorMs -= state.settings.fixedDtMs
      runSimulationStep(state.settings.fixedDtMs)
      steps += 1
    }

    // Extra safety: if we're still far behind after step cap, drop backlog to prevent spiral-of-death.
    if (steps === MAX_FIXED_STEPS_PER_ADVANCE && accumulatorMs >= state.settings.fixedDtMs) {
      accumulatorMs = accumulatorMs % state.settings.fixedDtMs
    }

    lastAdvanceSteps = steps
    persistBestScore()
    emit()
    return steps
  }

  const subscribe = (listener: (currentState: Readonly<GameState>) => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const subscribeEvents = (listener: (events: readonly GamePresentationEvent[]) => void) => {
    eventListeners.add(listener)
    return () => { eventListeners.delete(listener) }
  }

  return {
    getState: () => state,
    getDiagnostics: () => ({
      accumulatorMs,
      lastAdvanceSteps,
    }),
    setInputTrails,
    clearInputTrails: (pointerId) => {
      inputTrails = pointerId === undefined ? [] : inputTrails.filter((trail) => trail.pointerId !== pointerId)
      for (const [id, stroke] of Object.entries(state.score.strokes)) {
        if (pointerId === undefined || stroke.pointerId === pointerId) delete state.score.strokes[Number(id)]
      }
      state.score.strokeCombo = 0
    },
    setMode,
    setWorldBounds: (bounds) => {
      if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || bounds.x < 128 || bounds.y < 128) return
      if (bounds.x === state.world.bounds.x && bounds.y === state.world.bounds.y) return
      inputTrails = []
      state.score.strokes = {}
      state.score.strokeCombo = 0
      resizeWorld(state.world, bounds)
      emit()
    },
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
    subscribeEvents,
  }
}
