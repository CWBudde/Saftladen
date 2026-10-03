import type { ScoreFeedbackEvent } from '../types'
import { drawBladeSegment } from './cosmeticArt'
import type { RenderContext } from './renderTypes'

export function drawScoreFeedbackLayer(
  ctx: CanvasRenderingContext2D,
  feedback: readonly ScoreFeedbackEvent[],
  elapsedMs: number,
  scaleX: number,
  scaleY: number,
  reducedMotion: boolean,
): void {
  for (const event of feedback) {
    // Bomb penalties have a separate presentation-clock label, including +0.
    if (event.amount <= 0) continue
    const ageMs = elapsedMs - event.createdAtMs
    const lifeProgress = Math.max(0, Math.min(1, ageMs / event.lifetimeMs))
    const alpha = 1 - lifeProgress
    const x = event.position.x * scaleX
    const y = event.position.y * scaleY - (reducedMotion ? 0 : lifeProgress * 36)
      - ((event.strokeCombo ?? 0) >= 3 ? 42 : 0)

    ctx.save()
    if (!reducedMotion) {
      ctx.globalAlpha = alpha * 0.45
      ctx.strokeStyle = '#fde047'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, event.position.y * scaleY, 10 + lifeProgress * 26, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.globalAlpha = alpha
    ctx.fillStyle = event.amount < 0 ? '#fecaca' : '#ecfdf5'
    ctx.font = (event.strokeCombo ?? 0) >= 3
      ? "800 22px 'Trebuchet MS', 'Segoe UI', sans-serif"
      : "800 19px 'Trebuchet MS', 'Segoe UI', sans-serif"
    ctx.textAlign = 'center'
    ctx.strokeStyle = '#1e0f0a'
    ctx.lineWidth = 3.5
    const scoreLabel = event.amount >= 0 ? '+' + event.amount : String(event.amount)
    ctx.strokeText(scoreLabel, x, y)
    ctx.fillText(scoreLabel, x, y)

    if ((event.strokeCombo ?? 0) >= 3 || event.combo > 1) {
      ctx.font = "800 13px 'Trebuchet MS', 'Segoe UI', sans-serif"
      ctx.fillStyle = '#fde047'
      const label = (event.strokeCombo ?? 0) >= 3
        ? 'STROKE COMBO · ' + event.strokeCombo
        : 'STREAK · ' + event.combo + ' HITS'
      ctx.strokeText(label, x, y - 22)
      ctx.fillText(label, x, y - 22)
    }
    ctx.restore()
  }
}

export function drawBladeTrails(ctx: CanvasRenderingContext2D, context: RenderContext, nowMs: number): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // TrailTracker bounds the trail history; cap work here as a second guard.
  for (let trailIndex = 0; trailIndex < Math.min(10, context.debug.trails.length); trailIndex += 1) {
    const trail = context.debug.trails[trailIndex]
    const points = trail.canvasPoints
    const firstIndex = Math.max(1, points.length - 24)
    for (let i = firstIndex; i < points.length; i += 1) {
      const from = points[i - 1]
      const to = points[i]
      const freshness = Math.max(0, 1 - Math.max(0, nowMs - (to.tMs ?? nowMs)) / 150)
      if (freshness <= 0 || (from.x === to.x && from.y === to.y)) continue
      const taper = (i - firstIndex + 1) / Math.max(1, points.length - firstIndex)
      const width = (1.5 + taper * 4.5) * freshness
      drawBladeSegment(ctx, context.cosmetics?.blade ?? 'bamboo', from, to, width, freshness)
    }
  }
  ctx.restore()
}
