import type { GameEngine } from '../engine'
import { createTrailTracker, isPointInsideCanvas } from '../input'
import { createRenderer, type PointerTrailDebug } from '../render'
import type { GamePresentationEvent, Vec2 } from '../types'
import type { CosmeticSelection } from '../ui/cosmetics'
import { resizeCanvasToDisplaySize } from './canvasStage'
import { createGameLoop } from './gameLoop'
import { canvasPointToWorld, createViewportTransform, getAdaptiveWorldBounds } from './viewport'

export type CanvasPreferences = {
  debugEnabled: boolean
  sliceSensitivity: number
  reducedMotion: boolean
  cosmetics?: CosmeticSelection
}

/** Owns input, simulation and rendering; React only mounts this controller. */
export function mountGameCanvas(
  canvas: HTMLCanvasElement,
  engine: GameEngine,
  getPreferences: () => CanvasPreferences,
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const renderer = createRenderer()
  const tracker = createTrailTracker()
  let metrics = resizeCanvasToDisplaySize(canvas, ctx)
  engine.setWorldBounds(getAdaptiveWorldBounds(metrics))
  let viewport = createViewportTransform(metrics, engine.getState().world.bounds)
  let rect = canvas.getBoundingClientRect()
  let lastPointerCanvas: Vec2 | null = null
  let lastPointerWorld: Vec2 | null = null
  let previousPhase = engine.getState().phase
  let previousWorld = engine.getState().world
  let previousBounds = previousWorld.bounds
  let presentationEvents: GamePresentationEvent[] = []
  const unsubscribeEvents = engine.subscribeEvents((events) => presentationEvents.push(...events))

  const clearInput = () => {
    tracker.clear()
    engine.clearInputTrails()
    lastPointerCanvas = null
    lastPointerWorld = null
  }

  const syncMetrics = () => {
    metrics = resizeCanvasToDisplaySize(canvas, ctx)
    engine.setWorldBounds(getAdaptiveWorldBounds(metrics))
    viewport = createViewportTransform(metrics, engine.getState().world.bounds)
    rect = canvas.getBoundingClientRect()
    tracker.setViewportScale(viewport.scale)
    clearInput()
  }
  tracker.setViewportScale(viewport.scale)

  const pointFromEvent = (event: PointerEvent) => ({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    tMs: event.timeStamp,
  })

  const updateProbe = (point: Vec2) => {
    if (!isPointInsideCanvas(point, metrics)) return
    lastPointerCanvas = point
    lastPointerWorld = canvasPointToWorld(point, viewport)
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (
      engine.getState().phase !== 'running' ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return
    // Refresh the cached origin at gesture start, never on each move.
    rect = canvas.getBoundingClientRect()
    tracker.setSliceSensitivity(getPreferences().sliceSensitivity)
    const point = pointFromEvent(event)
    tracker.beginTrail(event.pointerId, point)
    updateProbe(point)
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Capture can fail if a pointer is no longer active.
    }
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!tracker.hasTrail(event.pointerId)) return
    const samples = event.getCoalescedEvents?.() ?? []
    for (const sample of samples.length ? samples : [event]) {
      const point = pointFromEvent(sample)
      tracker.appendPoint(event.pointerId, point)
      updateProbe(point)
    }
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (!tracker.hasTrail(event.pointerId)) return
    const point = pointFromEvent(event)
    tracker.endTrail(event.pointerId, point)
    updateProbe(point)
  }

  const handlePointerCancel = (event: PointerEvent) => {
    if (tracker.hasTrail(event.pointerId)) {
      tracker.cancelTrail(event.pointerId)
      engine.clearInputTrails(event.pointerId)
    }
  }

  const pauseForBackground = () => {
    clearInput()
    if (engine.getState().phase === 'running') engine.pause()
  }
  const handleVisibility = () => {
    if (document.hidden) pauseForBackground()
  }

  const unsubscribe = engine.subscribe((state) => {
    if (state.world !== previousWorld)
      presentationEvents = presentationEvents.filter((event) => event.runId === state.run.id)
    if (
      state.phase !== previousPhase ||
      state.world !== previousWorld ||
      state.world.bounds !== previousBounds
    )
      clearInput()
    if (state.world.bounds !== previousBounds) {
      viewport = createViewportTransform(metrics, state.world.bounds)
      tracker.setViewportScale(viewport.scale)
    }
    previousPhase = state.phase
    previousWorld = state.world
    previousBounds = state.world.bounds
  })

  const loop = createGameLoop({
    onFrame: (frameInfo) => {
      const preferences = getPreferences()
      tracker.setSliceSensitivity(preferences.sliceSensitivity)
      // Queue raw motion before stepping. Visual history never cuts.
      engine.setInputTrails(
        tracker.drainSliceTrails(frameInfo.timestampMs).map((trail) => ({
          pointerId: trail.pointerId,
          strokeId: trail.strokeId,
          ended: trail.ended,
          points: trail.points.map((point) => ({
            ...canvasPointToWorld(point, viewport),
            tMs: point.tMs,
          })),
        })),
      )
      engine.advanceBy(frameInfo.deltaMs)
      const frameEvents = presentationEvents
      presentationEvents = []

      const trails: PointerTrailDebug[] = tracker
        .getActiveTrails(frameInfo.timestampMs)
        .map((trail) => ({
          pointerId: trail.pointerId,
          rawCanvasPoints: trail.points,
          canvasPoints: trail.points,
          worldPoints: trail.points.map((point) => canvasPointToWorld(point, viewport)),
          velocityPxPerS: trail.velocityPxPerS,
          isSliceActive: trail.isSliceActive,
        }))
      renderer.render(ctx, engine.getState(), frameInfo, {
        metrics,
        reducedMotion: preferences.reducedMotion,
        cosmetics: preferences.cosmetics,
        presentationEvents: frameEvents,
        debug: {
          enabled: preferences.debugEnabled,
          diagnostics: engine.getDiagnostics(),
          trails,
          lastPointerCanvas,
          lastPointerWorld,
        },
      })
    },
  })

  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerup', handlePointerUp)
  canvas.addEventListener('pointercancel', handlePointerCancel)
  canvas.addEventListener('lostpointercapture', handlePointerCancel)
  window.addEventListener('blur', pauseForBackground)
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('resize', syncMetrics)
  const resizeObserver = new ResizeObserver(syncMetrics)
  resizeObserver.observe(canvas)
  loop.start()

  return () => {
    loop.stop()
    unsubscribe()
    unsubscribeEvents()
    presentationEvents = []
    clearInput()
    resizeObserver.disconnect()
    window.removeEventListener('resize', syncMetrics)
    window.removeEventListener('blur', pauseForBackground)
    document.removeEventListener('visibilitychange', handleVisibility)
    canvas.removeEventListener('pointerdown', handlePointerDown)
    canvas.removeEventListener('pointermove', handlePointerMove)
    canvas.removeEventListener('pointerup', handlePointerUp)
    canvas.removeEventListener('pointercancel', handlePointerCancel)
    canvas.removeEventListener('lostpointercapture', handlePointerCancel)
  }
}
