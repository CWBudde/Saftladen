import type { GamePresentationEvent, Vec2 } from '../types'
import type { ViewportTransform } from '../core/viewport'

type Impact = {
  event: Extract<GamePresentationEvent, { type: 'stroke-combo' | 'bomb-hit' }>
  startedAtMs: number
  normalizedPosition: Vec2
}

const MAX_IMPACTS = 12
const BOMB_LIFETIME_MS = 700
const COMBO_LIFETIME_MS = 360

/** Bounded, event-driven effects. The RAF clock ages them even after game-over. */
export function createImpactFeedback() {
  const impacts: Impact[] = []
  let lastEventId = -1
  let bombFlashStartedAtMs = -Infinity

  const reset = () => {
    impacts.length = 0
    lastEventId = -1
    bombFlashStartedAtMs = -Infinity
  }

  const consume = (events: readonly GamePresentationEvent[], nowMs: number, bounds: Vec2) => {
    for (const event of events) {
      if (event.id <= lastEventId) continue
      lastEventId = event.id
      if (event.type !== 'stroke-combo' && event.type !== 'bomb-hit') continue
      // Growing a combo refreshes one burst instead of stacking rings per fruit.
      if (event.type === 'stroke-combo') {
        const index = impacts.findIndex((impact) => impact.event.type === 'stroke-combo' && impact.event.strokeId === event.strokeId)
        if (index >= 0) impacts.splice(index, 1)
      } else {
        bombFlashStartedAtMs = nowMs
      }
      impacts.push({ event, startedAtMs: nowMs, normalizedPosition: {
        x: event.position.x / bounds.x, y: event.position.y / bounds.y,
      } })
      if (impacts.length > MAX_IMPACTS) impacts.shift()
    }
  }

  const draw = (
    ctx: CanvasRenderingContext2D, nowMs: number, viewport: ViewportTransform,
    bounds: Vec2, width: number, height: number, reducedMotion: boolean,
  ) => {
    const flashAge = nowMs - bombFlashStartedAtMs
    if (!reducedMotion && flashAge >= 0 && flashAge < 220) {
      ctx.save()
      ctx.globalAlpha = (1 - flashAge / 220) * 0.28
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }
    for (let i = impacts.length - 1; i >= 0; i -= 1) {
      const impact = impacts[i]
      const bomb = impact.event.type === 'bomb-hit'
      const lifetime = bomb ? BOMB_LIFETIME_MS : COMBO_LIFETIME_MS
      const age = Math.max(0, nowMs - impact.startedAtMs)
      if (age >= lifetime) {
        impacts.splice(i, 1)
        continue
      }
      const x = viewport.offsetX + impact.normalizedPosition.x * bounds.x * viewport.scale
      const y = viewport.offsetY + impact.normalizedPosition.y * bounds.y * viewport.scale
      ctx.save()
      const burstDuration = bomb ? 420 : COMBO_LIFETIME_MS
      if (!reducedMotion && age < burstDuration) {
        const progress = age / burstDuration
        const radius = (bomb ? 20 : 14) + progress * (bomb ? 62 : 42)
        ctx.globalAlpha = (1 - progress) * 0.85
        ctx.strokeStyle = bomb ? '#fb923c' : '#fde047'
        ctx.lineWidth = (bomb ? 4 : 3) * (1 - progress) + 1
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, radius * 0.65, 0, Math.PI * 2)
        ctx.stroke()
        // Deterministic rays use no gameplay or cosmetic random stream.
        ctx.beginPath()
        for (let ray = 0; ray < 8; ray += 1) {
          const angle = ray * Math.PI / 4 + (bomb ? Math.PI / 8 : 0)
          ctx.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
          ctx.lineTo(x + Math.cos(angle) * (radius + 12 * (1 - progress)), y + Math.sin(angle) * (radius + 12 * (1 - progress)))
        }
        ctx.stroke()
      }
      if (impact.event.type === 'bomb-hit') {
        // Keep the penalty legible without animation, including zero-score hits.
        const label = impact.event.penalty > 0 ? 'BOMB · −' + impact.event.penalty : 'BOMB HIT'
        ctx.font = "900 18px 'Trebuchet MS', 'Segoe UI', sans-serif"
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const labelWidth = Math.min(width - 16, ctx.measureText(label).width + 20)
        const labelX = Math.max(labelWidth / 2 + 8, Math.min(width - labelWidth / 2 - 8, x))
        const labelY = Math.max(20, Math.min(height - 20, y - 42))
        ctx.globalAlpha = Math.min(1, (lifetime - age) / 160)
        ctx.fillStyle = '#32150f'
        ctx.fillRect(labelX - labelWidth / 2, labelY - 15, labelWidth, 30)
        ctx.fillStyle = '#ffddc2'
        ctx.fillText(label, labelX, labelY)
      }
      ctx.restore()
    }
  }

  return { consume, draw, reset }
}
