import type { EngineDiagnostics } from '../engine'
import type { FrameInfo } from '../core/gameLoop'
import type { CanvasMetrics } from '../core/canvasStage'
import type { GameState, Vec2 } from '../types'

export type PointerTrailDebug = {
  pointerId: number
  rawCanvasPoints: Vec2[]
  canvasPoints: Vec2[]
  worldPoints: Vec2[]
  velocityPxPerS: number
  isSliceActive: boolean
}

export type RendererDebugData = {
  enabled: boolean
  diagnostics: EngineDiagnostics
  trails: PointerTrailDebug[]
  lastPointerCanvas: Vec2 | null
  lastPointerWorld: Vec2 | null
}

export type RenderContext = {
  metrics: CanvasMetrics
  debug: RendererDebugData
}

export interface Renderer {
  render: (ctx: CanvasRenderingContext2D, state: GameState, frameInfo: FrameInfo, context: RenderContext) => void
}
