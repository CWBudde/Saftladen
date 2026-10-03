import type { GameUiSnapshot } from './viewModel'
import type { PowerUpType } from '../types'
import { DOUBLE_POINTS_POWER_UP_DURATION_MS, FREEZE_POWER_UP_DURATION_MS, FRENZY_POWER_UP_DURATION_MS } from '../systems/constants'

const POWER_UP_LABELS: Record<PowerUpType, string> = {
  freeze: 'Freeze', frenzy: 'Frenzy', 'double-points': 'Double points',
}
const POWER_UP_ICONS: Record<PowerUpType, string> = {
  freeze: '❄', frenzy: '⚡', 'double-points': '×2',
}
const POWER_UP_DURATIONS: Record<PowerUpType, number> = {
  freeze: FREEZE_POWER_UP_DURATION_MS, frenzy: FRENZY_POWER_UP_DURATION_MS,
  'double-points': DOUBLE_POINTS_POWER_UP_DURATION_MS,
}

export function GameHud({ snapshot, onPause }: { snapshot: GameUiSnapshot; onPause: () => void }) {
  const remainingMs = snapshot.mode === 'arcade' ? snapshot.arcadeRemainingMs : snapshot.zenRemainingMs
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  return (
    <div className="game-hud" role="group" aria-label="Run statistics">
      <div className="hud-main">
        <p className="hud-score"><span>Score</span><strong>{snapshot.score}</strong></p>
        {snapshot.mode === 'classic' ? (
          <p className="hud-lives" aria-label={`${snapshot.strikesRemaining} of ${snapshot.strikesMax} lives remaining`}>
            {Array.from({ length: snapshot.strikesMax }, (_, i) => (
              <span key={i} className={i < snapshot.strikesRemaining ? '' : 'lost'} aria-hidden="true">♥</span>
            ))}
          </p>
        ) : (
          <p className={`hud-timer ${seconds <= 10 ? 'urgent' : ''}`} aria-label={`${seconds} seconds remaining`}>
            <span>Time</span><strong>{seconds}s</strong>
          </p>
        )}
        <button type="button" className="ghost-button hud-pause" data-focus-anchor onClick={onPause}
          disabled={snapshot.view !== 'playing'}>Pause</button>
      </div>
      <div className="hud-effects">
        {snapshot.strokeCombo >= 3 ? <p className="hud-streak">Stroke combo · {snapshot.strokeCombo} fruit</p> : null}
        {snapshot.combo > 1 ? <p className="hud-streak">Streak · {snapshot.combo} hits · ×{snapshot.streakMultiplier} points</p> : null}
        {snapshot.activePowerUps.map((powerUp) => {
          const duration = snapshot.powerUpRemainingMs[powerUp]
          return (
            <div key={powerUp} className="hud-power-up">
              <span><span aria-hidden="true">{POWER_UP_ICONS[powerUp]} </span>{POWER_UP_LABELS[powerUp]} · {Math.ceil(duration / 1000)}s</span>
              <meter min={0} max={POWER_UP_DURATIONS[powerUp]} value={duration}
                aria-label={`${POWER_UP_LABELS[powerUp]} time remaining`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
