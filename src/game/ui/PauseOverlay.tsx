import { formatDuration } from './formatDuration'
import { GameDialog } from './GameDialog'
import { SettingsControls } from './SettingsControls'
import type { GameUiSnapshot, UiSettings } from './viewModel'

type PauseOverlayProps = {
  uiSnapshot: GameUiSnapshot
  uiSettings: UiSettings
  updateUiSettings: (patch: Partial<UiSettings>) => void
  handleResume: () => void
  handleRestart: () => void
  handleReturnToMenu: () => void
}

export function PauseOverlay({
  uiSnapshot,
  uiSettings,
  updateUiSettings,
  handleResume,
  handleRestart,
  handleReturnToMenu,
}: PauseOverlayProps) {
  return (
    <GameDialog
      className="overlay-card"
      labelledBy="pause-heading"
      onDismiss={handleResume}
      returnFocusSelector="[data-focus-anchor]:not(:disabled)"
    >
      <h2 id="pause-heading">Run Paused</h2>
      <p>Mode: {uiSnapshot.mode}</p>
      <p>Score: {uiSnapshot.score}</p>
      <div className="overlay-actions">
        <button type="button" className="primary-button" onClick={handleResume}>
          Resume
        </button>
        <button type="button" className="ghost-button" onClick={handleRestart}>
          Restart
        </button>
        <button type="button" className="ghost-button" onClick={handleReturnToMenu}>
          Main Menu
        </button>
      </div>
      {uiSnapshot.mode === 'arcade' ? (
        <p>Time Left: {formatDuration(uiSnapshot.arcadeRemainingMs)}</p>
      ) : uiSnapshot.mode === 'zen' ? (
        <p>Time Left: {formatDuration(uiSnapshot.zenRemainingMs)}</p>
      ) : null}
      <SettingsControls settings={uiSettings} onChange={updateUiSettings} />
    </GameDialog>
  )
}
