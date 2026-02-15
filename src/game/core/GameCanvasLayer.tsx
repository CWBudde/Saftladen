import { useEffect, useRef } from 'react'
import { isGameDebugEnabled } from '../debug'
import type { GameEngine } from '../engine'
import { createTrailTracker, isPointInsideCanvas, mapCanvasPointToWorld, pointerEventToCanvasLocal } from '../input'
import { createRenderer, type PointerTrailDebug } from '../render'
import type { SliceTrail, Vec2 } from '../types'
import { resizeCanvasToDisplaySize, type CanvasMetrics } from './canvasStage'
import { createGameLoop } from './gameLoop'

function toVec2Points(points: Array<{ x: number; y: number }>): Vec2[] {
  return points.map((point) => ({ x: point.x, y: point.y }))
}

type GameCanvasLayerProps = {
  engine: GameEngine
  debugEnabled?: boolean
}

export function GameCanvasLayer({ engine, debugEnabled = isGameDebugEnabled() }: GameCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const debugEnabledRef = useRef(debugEnabled)

  useEffect(() => {
    debugEnabledRef.current = debugEnabled
  }, [debugEnabled])

  useEffect(() => {
    const renderer = createRenderer()
    const trailTracker = createTrailTracker()
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    let metrics: CanvasMetrics = resizeCanvasToDisplaySize(canvas, ctx)
    let lastPointerCanvas: Vec2 | null = null
    let lastPointerWorld: Vec2 | null = null

    const syncCanvasMetrics = () => {
      metrics = resizeCanvasToDisplaySize(canvas, ctx)
    }

    const createTrailPointFromEvent = (event: PointerEvent) => {
      const canvasPoint = pointerEventToCanvasLocal(event, canvas)
      return {
        x: canvasPoint.x,
        y: canvasPoint.y,
        tMs: event.timeStamp,
      }
    }

    const updatePointerProbe = (canvasPoint: Vec2) => {
      if (isPointInsideCanvas(canvasPoint, metrics)) {
        lastPointerCanvas = canvasPoint
        lastPointerWorld = mapCanvasPointToWorld(canvasPoint, metrics, engine.getState().world.bounds)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      syncCanvasMetrics()
      const point = createTrailPointFromEvent(event)
      trailTracker.beginTrail(event.pointerId, point)
      updatePointerProbe(point)

      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture failures (for unsupported devices or stale pointer ids).
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!trailTracker.hasTrail(event.pointerId)) {
        return
      }

      const point = createTrailPointFromEvent(event)
      trailTracker.appendPoint(event.pointerId, point)
      updatePointerProbe(point)
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (!trailTracker.hasTrail(event.pointerId)) {
        return
      }

      const point = createTrailPointFromEvent(event)
      trailTracker.endTrail(event.pointerId, point)
      updatePointerProbe(point)
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerEnd)
    canvas.addEventListener('pointercancel', handlePointerEnd)
    const handleWindowBlur = () => {
      trailTracker.clear()
    }
    window.addEventListener('blur', handleWindowBlur)

    syncCanvasMetrics()
    window.addEventListener('resize', syncCanvasMetrics)

    const loop = createGameLoop({
      onFrame: (frameInfo) => {
        syncCanvasMetrics()
        engine.advanceBy(frameInfo.deltaMs)
        const state = engine.getState()
        const worldBounds = state.world.bounds
        const engineTrails: SliceTrail[] = []
        const trails: PointerTrailDebug[] = trailTracker.getActiveTrails().map((trail) => {
          const rawCanvasPoints = toVec2Points(trail.points)
          const canvasPoints = toVec2Points(trail.smoothedPoints)
          const worldPoints = rawCanvasPoints.map((point) => mapCanvasPointToWorld(point, metrics, worldBounds))
          const smoothedWorldPoints = trail.smoothedPoints.map((point) => ({
            ...mapCanvasPointToWorld(point, metrics, worldBounds),
            tMs: point.tMs,
          }))

          engineTrails.push({
            pointerId: trail.pointerId,
            points: smoothedWorldPoints,
          })

          return {
            pointerId: trail.pointerId,
            rawCanvasPoints,
            canvasPoints,
            worldPoints,
            velocityPxPerS: trail.velocityPxPerS,
            isSliceActive: trail.isSliceActive,
          }
        })
        engine.setInputTrails(engineTrails)

        renderer.render(ctx, state, frameInfo, {
          metrics,
          debug: {
            enabled: debugEnabledRef.current,
            diagnostics: engine.getDiagnostics(),
            trails,
            lastPointerCanvas,
            lastPointerWorld,
          },
        })
      },
    })

    loop.start()

    return () => {
      loop.stop()
      engine.stop()
      window.removeEventListener('resize', syncCanvasMetrics)
      window.removeEventListener('blur', handleWindowBlur)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerEnd)
      canvas.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [engine])

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Fruit slicing game canvas" />
}
