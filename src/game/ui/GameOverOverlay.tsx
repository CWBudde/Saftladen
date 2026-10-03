import type { ReactNode } from 'react'
import type { GameMode } from '../types'
import { CosmeticCard } from './CosmeticCard'
import type { CosmeticSelection, CosmeticUnlock } from './cosmetics'
import { formatDuration } from './formatDuration'
import { GameDialog } from './GameDialog'
import { GoalList } from './GoalList'
import { MODE_NAMES, type ProgressionGoal } from './progression'
import type { RewardProfile, RunRewards } from './rewards'
import type { GameUiSnapshot } from './viewModel'

type GameOverOverlayProps = {
  uiSnapshot: GameUiSnapshot
  rewardProfile: RewardProfile
  lastRunRewards: RunRewards | null
  newUnlocks: CosmeticUnlock[]
  cosmetics: CosmeticSelection
  selectedMode: GameMode
  nextGoal: ProgressionGoal
  canStart: boolean
  updating: boolean
  liveAnnouncement: ReactNode
  updateNotice: ReactNode
  equipCosmetic: (item: CosmeticUnlock) => void
  playGoal: () => void
  handleRestart: () => void
  openEquipment: () => void
  handleReturnToMenu: () => void
}

export function GameOverOverlay({
  uiSnapshot, rewardProfile, lastRunRewards, newUnlocks,
  cosmetics, selectedMode, nextGoal, canStart,
  updating, liveAnnouncement, updateNotice, equipCosmetic,
  playGoal, handleRestart, openEquipment, handleReturnToMenu,
}: GameOverOverlayProps) {
  return (
    <GameDialog className="overlay-card" labelledBy="game-over-heading" onDismiss={handleReturnToMenu}
      returnFocusSelector="[data-focus-anchor]:not(:disabled)">
      {liveAnnouncement}
      <h2 id="game-over-heading">Run Complete</h2>
      {updateNotice}
      <p>
        Score {uiSnapshot.score} · {uiSnapshot.mode[0].toUpperCase() + uiSnapshot.mode.slice(1)} best {uiSnapshot.bestScore}
      </p>
      <p>
        Peak streak · {uiSnapshot.stats.peakCombo} hits · Time {formatDuration(uiSnapshot.elapsedMs)}
      </p>
      <dl className="result-stats">
        <div><dt>Fruit sliced</dt><dd>{uiSnapshot.stats.fruitSliced}</dd></div>
        <div><dt>Misses</dt><dd>{uiSnapshot.stats.missedFruits}</dd></div>
        <div><dt>Bomb hits</dt><dd>{uiSnapshot.stats.bombHits}</dd></div>
        <div><dt>Best stroke combo</dt><dd>{uiSnapshot.stats.peakStrokeCombo} fruit</dd></div>
        <div><dt>Stroke accuracy</dt><dd>{uiSnapshot.stats.strokesAttempted > 0
          ? Math.round(100 * uiSnapshot.stats.successfulStrokes / uiSnapshot.stats.strokesAttempted)
          : 0}%<small> ({uiSnapshot.stats.successfulStrokes}/{uiSnapshot.stats.strokesAttempted})</small></dd></div>
      </dl>
      {lastRunRewards ? (
        <div className="reward-strip">
          {lastRunRewards.status === 'ineligible' ? <p>Slice fruit and play at least 5 seconds to earn rewards.</p> : null}
          {lastRunRewards.flawless ? <p>Flawless run bonus</p> : null}
          <p>+{lastRunRewards.xpEarned} XP</p>
          <p>+{lastRunRewards.starfruitEarned} Starfruit</p>
          {lastRunRewards.objectiveCompletions.length > 0 ? (
            <p>Objectives: {lastRunRewards.objectiveCompletions.join(', ')}</p>
          ) : null}
          {lastRunRewards.goalCompletions.length > 0
            ? <p>Goals completed: {lastRunRewards.goalCompletions.join(', ')}</p> : null}
          {lastRunRewards.challengesRotated ? <p>A fresh challenge set is ready!</p> : null}
        </div>
      ) : null}
      {newUnlocks.length ? <section className="unlock-celebration" aria-label="New cosmetic unlocks">
        <h3>New rewards unlocked!</h3>
        <p>Your next run can have a new look.</p>
        <ul className="cosmetic-rewards">
          {newUnlocks.map(item => <CosmeticCard key={item.id} item={item} profile={rewardProfile}
            selection={cosmetics} onEquip={equipCosmetic} />)}
        </ul>
      </section> : null}
      <section aria-label="Next goal">
        <p className="next-objective">Next goal: {nextGoal.title} ({nextGoal.progress}/{nextGoal.target}{nextGoal.metric === 'accuracy' ? '%' : ''})</p>
        <p>{nextGoal.description}</p>
        <button type="button" className="primary-button" onClick={playGoal} disabled={!canStart}>Play {MODE_NAMES[nextGoal.mode]} goal</button>
      </section>
      <GoalList goals={rewardProfile.challenges.goals} label="Challenge progress" />
      <GoalList goals={rewardProfile.achievements.filter(goal => goal.mode === selectedMode)} label="Mode achievement progress" />
      <ul className="objective-list" aria-label="Objective progress">
        {rewardProfile.objectives.map(objective => <li key={objective.id}
          className={objective.completed ? 'done' : ''}>
          <div className="objective-row"><span>{objective.title}</span>
            <strong>{Math.min(objective.progress, objective.target)}/{objective.target}</strong></div>
        </li>)}
      </ul>
      <div className="overlay-actions">
        <button type="button" className="primary-button" onClick={handleRestart} disabled={updating}>
          Run Again
        </button>
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
