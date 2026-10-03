import { gameAssets } from '../assets'
import { createTrailTracker } from '../input/trailTracker'
import { getSpriteScale } from '../render/renderHelpers'
import { segmentCircleHitFraction } from '../systems/collision'
import type { Vec2 } from '../types'
import { resizeCanvasToDisplaySize } from './canvasStage'
import { WORLD_SHORT_EDGE } from './viewport'

export type PracticeFeedback = 'ready' | 'success' | 'miss' | 'unavailable'
export type PracticePreferences = { sliceSensitivity: number; reducedMotion: boolean }

/** Static practice target with event-driven input/rendering and no game state. */
export function mountPracticeCanvas(
  canvas: HTMLCanvasElement,
  getPreferences: () => PracticePreferences,
  onFeedback: (feedback: PracticeFeedback) => void,
): { reset: () => void; refresh: () => void; dispose: () => void } {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    onFeedback('unavailable')
    return { reset: () => {}, refresh: () => {}, dispose: () => {} }
  }
  const tracker = createTrailTracker()
  const capturedPointers = new Set<number>()
  let metrics = resizeCanvasToDisplaySize(canvas, ctx)
  let rect = canvas.getBoundingClientRect()
  let sliced = false
  let direction: Vec2 = { x: 1, y: 0 }
  let blade: { start: Vec2; end: Vec2 } | null = null
  let disposed = false
  const center = () => ({ x: metrics.widthCssPx / 2, y: metrics.heightCssPx / 2 })
  const radius = () => Math.max(18, Math.min(44, metrics.widthCssPx * 0.14, metrics.heightCssPx * 0.22))

  const releasePointer = (pointerId: number) => {
    if (!capturedPointers.delete(pointerId)) return
    try { canvas.releasePointerCapture(pointerId) } catch { /* Capture may already have ended. */ }
  }
  const clearInput = () => {
    tracker.clear()
    blade = null
    for (const pointerId of capturedPointers) releasePointer(pointerId)
  }

  const drawApple = (cut = false) => {
    const image = gameAssets.getImage(cut ? 'appleCut' : 'appleWhole') ?? gameAssets.getImage('appleWhole')
    const size = radius()
    if (image) {
      const scale = getSpriteScale(image.naturalWidth, image.naturalHeight)
      const width = size * scale.widthPerRadius
      const height = size * scale.heightPerRadius
      ctx.drawImage(image, -width / 2, -height / 2, width, height)
    } else {
      ctx.fillStyle = '#ed5349'
      ctx.beginPath()
      ctx.arc(0, 0, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#82ce65'
      ctx.beginPath()
      ctx.ellipse(size * 0.2, -size * 0.85, size * 0.3, size * 0.12, -0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const render = () => {
    if (disposed) return
    ctx.clearRect(0, 0, metrics.widthCssPx, metrics.heightCssPx)
    ctx.fillStyle = '#25160f'
    ctx.fillRect(0, 0, metrics.widthCssPx, metrics.heightCssPx)
    const target = center()
    ctx.save()
    ctx.translate(target.x, target.y)
    if (sliced) {
      const normal = { x: -direction.y, y: direction.x }
      const angle = Math.atan2(normal.y, normal.x)
      const offset = getPreferences().reducedMotion ? 0 : 12
      for (const side of [-1, 1]) {
        ctx.save()
        ctx.translate(normal.x * offset * side, normal.y * offset * side)
        ctx.rotate(angle)
        const extent = radius() * 4
        ctx.beginPath()
        ctx.rect(side < 0 ? -extent : 0, -extent, extent, extent * 2)
        ctx.clip()
        ctx.rotate(-angle)
        drawApple(true)
        ctx.restore()
      }
    } else drawApple()
    ctx.restore()
    if (blade) {
      ctx.strokeStyle = '#ddfcff'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(blade.start.x, blade.start.y)
      ctx.lineTo(blade.end.x, blade.end.y)
      ctx.stroke()
    }
  }

  const consumeFreshMovement = (nowMs: number) => {
    for (const trail of tracker.drainSliceTrails(nowMs)) {
      for (let index = 1; index < trail.points.length; index++) {
        const start = trail.points[index - 1]
        const end = trail.points[index]
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        if (length === 0) continue
        blade = { start, end }
        if (!sliced && segmentCircleHitFraction(start, end, center(), radius()) !== null) {
          sliced = true
          direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length }
          clearInput()
          onFeedback('success')
          return
        }
      }
    }
  }

  const point = (event: PointerEvent) => ({
    x: event.clientX - rect.left, y: event.clientY - rect.top, tMs: event.timeStamp,
  })
  const pointerDown = (event: PointerEvent) => {
    if (sliced || (event.pointerType === 'mouse' && event.button !== 0)) return
    // Refresh layout and DPR at gesture start; no frame loop or move-time reads.
    const nextMetrics = resizeCanvasToDisplaySize(canvas, ctx)
    if (nextMetrics.widthCssPx !== metrics.widthCssPx || nextMetrics.heightCssPx !== metrics.heightCssPx || nextMetrics.dpr !== metrics.dpr) clearInput()
    metrics = nextMetrics
    rect = canvas.getBoundingClientRect()
    // Match the full playfield's CSS velocity threshold, rather than the small
    // practice panel's dimensions, so a phone swipe has the same sensitivity.
    tracker.setViewportScale(Math.min(window.innerWidth, window.innerHeight) / WORLD_SHORT_EDGE)
    tracker.setSliceSensitivity(getPreferences().sliceSensitivity)
    tracker.beginTrail(event.pointerId, point(event))
    capturedPointers.add(event.pointerId)
    try { canvas.setPointerCapture(event.pointerId) } catch { /* Pointer may no longer be active. */ }
    render()
  }
  const pointerMove = (event: PointerEvent) => {
    if (!tracker.hasTrail(event.pointerId)) return
    tracker.setSliceSensitivity(getPreferences().sliceSensitivity)
    const samples = event.getCoalescedEvents?.() ?? []
    for (const sample of samples.length ? samples : [event]) tracker.appendPoint(event.pointerId, point(sample))
    consumeFreshMovement(event.timeStamp)
    render()
  }
  const pointerUp = (event: PointerEvent) => {
    if (!tracker.hasTrail(event.pointerId)) return
    tracker.setSliceSensitivity(getPreferences().sliceSensitivity)
    tracker.endTrail(event.pointerId, point(event))
    consumeFreshMovement(event.timeStamp)
    tracker.cancelTrail(event.pointerId)
    releasePointer(event.pointerId)
    blade = null
    if (!sliced) onFeedback('miss')
    render()
  }
  const pointerCancel = (event: PointerEvent) => {
    tracker.cancelTrail(event.pointerId)
    releasePointer(event.pointerId)
    blade = null
    render()
  }
  const clearAndRender = () => { clearInput(); render() }
  const visibilityChanged = () => { if (document.hidden) clearAndRender() }
  const resize = () => {
    clearInput()
    metrics = resizeCanvasToDisplaySize(canvas, ctx)
    rect = canvas.getBoundingClientRect()
    render()
  }
  const reset = () => {
    if (disposed) return
    clearInput()
    sliced = false
    onFeedback('ready')
    render()
  }

  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointercancel', pointerCancel)
  canvas.addEventListener('lostpointercapture', pointerCancel)
  window.addEventListener('resize', resize)
  window.addEventListener('blur', clearAndRender)
  document.addEventListener('visibilitychange', visibilityChanged)
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  const unsubscribeAssets = gameAssets.subscribe(render)
  render()

  return {
    reset,
    refresh: render,
    dispose: () => {
      if (disposed) return
      disposed = true
      clearInput()
      unsubscribeAssets()
      observer.disconnect()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerCancel)
      canvas.removeEventListener('lostpointercapture', pointerCancel)
      window.removeEventListener('resize', resize)
      window.removeEventListener('blur', clearAndRender)
      document.removeEventListener('visibilitychange', visibilityChanged)
    },
  }
}
