import type { CanvasMetrics } from '../core/canvasStage'
import type { FrameInfo } from '../core/gameLoop'
import type { EngineDiagnostics } from '../engine'
import type { GamePresentationEvent, GameState, Vec2 } from '../types'
import type { CosmeticSelection } from '../ui/cosmetics'

export type PointerTrailDebug = {
  pointerId: number
  rawCanvasPoints: Vec2[]
  canvasPoints: (Vec2 & { tMs?: number })[]
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
  reducedMotion?: boolean
  cosmetics?: CosmeticSelection
  presentationEvents?: readonly GamePresentationEvent[]
}

export type Renderer = {
  render: (
    ctx: CanvasRenderingContext2D,
    state: Readonly<GameState>,
    frameInfo: FrameInfo,
    context: RenderContext,
  ) => void
}
