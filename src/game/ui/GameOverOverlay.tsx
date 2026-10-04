import type { ReactNode } from 'react'
import orange from '../../assets/orange1.webp'
import type { CosmeticUnlock } from './cosmetics'
import { formatDuration } from './formatDuration'
import { GameDialog } from './GameDialog'
import { MODE_NAMES } from './progression'
import type { RunRewards } from './rewards'
import type { GameUiSnapshot } from './viewModel'

type GameOverOverlayProps = {
  uiSnapshot: GameUiSnapshot
  lastRunRewards: RunRewards | null
  newUnlocks: CosmeticUnlock[]
  updating: boolean
  liveAnnouncement: ReactNode
  updateNotice: ReactNode
  handleRestart: () => void
  openEquipment: () => void
  handleReturnToMenu: () => void
}

export function GameOverOverlay({
  uiSnapshot,
  lastRunRewards,
  newUnlocks,
  updating,
  liveAnnouncement,
  updateNotice,
  handleRestart,
  openEquipment,
  handleReturnToMenu,
}: GameOverOverlayProps) {
  return (
    <GameDialog
      className="overlay-card result-card"
      labelledBy="game-over-heading"
      onDismiss={handleReturnToMenu}
      returnFocusSelector="[data-focus-anchor]:not(:disabled)"
    >
      {liveAnnouncement}
      <header className="result-header">
        <span className="result-brand">
          Saftladen<span aria-hidden="true">.</span>
        </span>
        <h2 id="game-over-heading">Run Complete</h2>
      </header>
      {updateNotice}
      <div className="result-scoreboard">
        <div>
          <p className="result-kicker">Fresh cut · {MODE_NAMES[uiSnapshot.mode]}</p>
          <p className="result-score">
            <span className="sr-only">Score </span>
            {uiSnapshot.score}
            <span aria-hidden="true"> pts</span>
          </p>
          <p className="result-best">
            {MODE_NAMES[uiSnapshot.mode]} best {uiSnapshot.bestScore} ·{' '}
            {formatDuration(uiSnapshot.elapsedMs)}
          </p>
        </div>
        <img className="result-fruit" src={orange} alt="" aria-hidden="true" />
      </div>
      <dl className="result-highlights">
        <div>
          <dt>Fruit sliced</dt>
          <dd>{uiSnapshot.stats.fruitSliced}</dd>
        </div>
        <div>
          <dt>Misses</dt>
          <dd>{uiSnapshot.stats.missedFruits}</dd>
        </div>
        <div>
          <dt>Bomb hits</dt>
          <dd>{uiSnapshot.stats.bombHits}</dd>
        </div>
        <div>
          <dt>Best stroke combo</dt>
          <dd>{uiSnapshot.stats.peakStrokeCombo} fruit</dd>
        </div>
        <div>
          <dt>Stroke accuracy</dt>
          <dd>
            {uiSnapshot.stats.strokesAttempted > 0
              ? Math.round(
                  (100 * uiSnapshot.stats.successfulStrokes) / uiSnapshot.stats.strokesAttempted,
                )
              : 0}
            %
            <span className="sr-only">
              {' '}
              ({uiSnapshot.stats.successfulStrokes}/{uiSnapshot.stats.strokesAttempted})
            </span>
          </dd>
        </div>
        <div>
          <dt>Peak streak</dt>
          <dd>{uiSnapshot.stats.peakCombo} hits</dd>
        </div>
      </dl>
      {lastRunRewards ? (
        <div className="reward-strip">
          <p className="result-earnings">
            <strong>+{lastRunRewards.xpEarned} XP</strong>
            <strong>+{lastRunRewards.starfruitEarned} Starfruit</strong>
          </p>
          {lastRunRewards.status === 'ineligible' ? (
            <p>Slice fruit and play at least 5 seconds to earn rewards.</p>
          ) : null}
          {lastRunRewards.flawless ? <p>Flawless run bonus</p> : null}
          {lastRunRewards.objectiveCompletions.length > 0 ? (
            <p>Objectives completed · {lastRunRewards.objectiveCompletions.length}</p>
          ) : null}
          {lastRunRewards.goalCompletions.length > 0 ? (
            <p>Goals completed · {lastRunRewards.goalCompletions.length}</p>
          ) : null}
          {lastRunRewards.challengesRotated ? <p>A fresh challenge set is ready!</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        className="primary-button result-replay"
        onClick={handleRestart}
        disabled={updating}
        autoFocus
      >
        Run Again <span aria-hidden="true">↗</span>
      </button>
      {newUnlocks.length ? (
        <p className="result-unlocks">
          {newUnlocks.length} new cosmetic {newUnlocks.length === 1 ? 'unlock' : 'unlocks'} · Choose
          equipment to try {newUnlocks.length === 1 ? 'it' : 'them'}.
        </p>
      ) : null}
      <div className="overlay-actions">
        <button type="button" className="ghost-button" onClick={openEquipment}>
          Choose equipment
        </button>
        <button type="button" className="ghost-button" onClick={handleReturnToMenu}>
          Main Menu
        </button>
      </div>
    </GameDialog>
  )
}
