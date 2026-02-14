import type { GamePhase } from '../types'

export type PhaseEvent = 'start' | 'pause' | 'resume' | 'stop' | 'reset' | 'game-over'

const PHASE_TRANSITIONS: Record<GamePhase, Partial<Record<PhaseEvent, GamePhase>>> = {
  idle: {
    start: 'running',
    reset: 'idle',
    stop: 'idle',
  },
  running: {
    pause: 'paused',
    stop: 'idle',
    reset: 'idle',
    'game-over': 'game-over',
  },
  paused: {
    resume: 'running',
    stop: 'idle',
    reset: 'idle',
    'game-over': 'game-over',
  },
  'game-over': {
    start: 'running',
    reset: 'idle',
    stop: 'idle',
  },
}

export function transitionGamePhase(phase: GamePhase, event: PhaseEvent): GamePhase {
  return PHASE_TRANSITIONS[phase][event] ?? phase
}
