import type { GameMode } from '../types'
import { GameDialog } from './GameDialog'
import { PracticeSwipe } from './PracticeSwipe'

export function OnboardingDialog({ mode, launching, sliceSensitivity, reducedMotion, onContinue, onDismiss }: {
  mode: GameMode
  launching: boolean
  sliceSensitivity: number
  reducedMotion: boolean
  onContinue: () => void
  onDismiss: () => void
}) {
  const modeName = mode[0].toUpperCase() + mode.slice(1)
  return (
    <GameDialog className="overlay-card onboarding-card" labelledBy="help-heading" onDismiss={onDismiss}
      returnFocusSelector={launching ? '.ring-mode.selected' : '.help-button'}>
      <h2 id="help-heading">How to play</h2>
      <p>Hold the mouse button and drag across fruit, or swipe with a finger.</p>
      <p>Slice 3 or more fruit in one held swipe for a combo bonus.</p>
      <PracticeSwipe sliceSensitivity={sliceSensitivity} reducedMotion={reducedMotion} />
      <p className="meta-subtle">Practice does not affect your score or rewards.</p>
      <dl className="help-mode-rules">
        <div data-selected={mode === 'classic'}><dt>Classic</dt><dd>Survive as long as you can. Three missed fruit end the run; one bomb ends it immediately.</dd></div>
        <div data-selected={mode === 'arcade'}><dt>Arcade</dt><dd>Score as much as you can in 60 seconds. Bombs cost half your score; missed fruit do not end the round.</dd></div>
        <div data-selected={mode === 'zen'}><dt>Zen</dt><dd>Enjoy 90 seconds of fruit. No bombs, no lives to lose.</dd></div>
      </dl>
      <p className="meta-subtle">Use the Pause button, Space or Escape to pause a run.</p>
      <div className="overlay-actions">
        <button type="button" className="primary-button" onClick={onContinue}>{launching ? `Play ${modeName}` : 'Done'}</button>
        {launching ? <button type="button" className="ghost-button" onClick={onContinue}>Skip practice</button> : null}
        {launching ? <button type="button" className="ghost-button" onClick={onDismiss}>Back to menu</button> : null}
      </div>
    </GameDialog>
  )
}
