import type { ReactNode } from 'react'
import {
  BLADE_UNLOCKS,
  DOJO_UNLOCKS,
  type CosmeticSelection,
  type CosmeticUnlock,
} from './cosmetics'
import { CosmeticCard } from './CosmeticCard'
import { GameDialog } from './GameDialog'
import { GoalList } from './GoalList'
import { MODE_NAMES, type ProgressionGoal } from './progression'
import { getRankInfo, type RewardProfile } from './rewards'
import { SettingsControls } from './SettingsControls'
import type { UiSettings } from './viewModel'

type ProfilePanelProps = {
  rewardProfile: RewardProfile
  cosmetics: CosmeticSelection
  nextGoal: ProgressionGoal
  canStart: boolean
  liveAnnouncement: ReactNode
  uiSettings: UiSettings
  updateUiSettings: (patch: Partial<UiSettings>) => void
  equipCosmetic: (item: CosmeticUnlock) => void
  playGoal: () => void
  onClose: () => void
}

export function ProfilePanel({
  rewardProfile,
  cosmetics,
  nextGoal,
  canStart,
  liveAnnouncement,
  uiSettings,
  updateUiSettings,
  equipCosmetic,
  playGoal,
  onClose,
}: ProfilePanelProps) {
  const rankInfo = getRankInfo(rewardProfile.xp)
  return (
    <GameDialog
      className="profile-panel"
      labelledBy="profile-heading"
      onDismiss={onClose}
      returnFocusSelector=".profile-button"
    >
      {/* The page's live region is inert while a native modal is open. */}
      {liveAnnouncement}
      <div className="profile-heading-row">
        <h2 id="profile-heading">Profile & Rewards</h2>
        <button type="button" className="ghost-button" onClick={onClose}>
          Close
        </button>
      </div>
      <section className="profile-card">
        <p className="meta-label">
          {rankInfo.rankName} · Level {rankInfo.level}
        </p>
        <div className="progress-track" aria-hidden="true">
          <div
            className="progress-fill"
            style={{ width: `${Math.round(rankInfo.levelProgress * 100)}%` }}
          />
        </div>
        <p className="meta-subtle">
          XP {rewardProfile.xp} · Starfruit earned {rewardProfile.starfruit}
        </p>
        <p className="meta-subtle">
          Earn Starfruit to unlock blades and XP to unlock dojos. Unlocks are automatic and
          permanent; nothing is spent. All rewards are cosmetic.
        </p>
      </section>

      <section className="profile-card">
        <p className="meta-label">Objectives</p>
        <ul className="objective-list">
          {rewardProfile.objectives.map((objective) => (
            <li key={objective.id} className={objective.completed ? 'done' : ''}>
              <div className="objective-row">
                <span>{objective.title}</span>
                <strong>
                  {Math.min(objective.progress, objective.target)}/{objective.target}
                </strong>
              </div>
              <small>{objective.description}</small>
              <small>
                Reward: {objective.rewardXp} XP · {objective.rewardStarfruit} Starfruit
              </small>
            </li>
          ))}
        </ul>
      </section>

      <section className="profile-card" aria-label="Next goal">
        <h3>Next goal: {nextGoal.title}</h3>
        <p>
          {nextGoal.description} ({nextGoal.progress}/{nextGoal.target}
          {nextGoal.metric === 'accuracy' ? '%' : ''})
        </p>
        <button type="button" className="primary-button" onClick={playGoal} disabled={!canStart}>
          Play {MODE_NAMES[nextGoal.mode]} goal
        </button>
      </section>
      <section className="profile-card" aria-label="Rotating challenges">
        <h3>Challenge set {rewardProfile.challenges.cycle + 1} of 3</h3>
        <p className="meta-subtle">
          No expiry or daily streak. Progress stays until all three finish, then a fresh set begins.
          Each challenge pays once per set.
        </p>
        <GoalList goals={rewardProfile.challenges.goals} label="Challenge progress" />
      </section>
      <section className="profile-card" aria-label="Mode achievements">
        <h3>Mode achievements</h3>
        <p className="meta-subtle">Permanent milestones with one-time rewards.</p>
        <GoalList goals={rewardProfile.achievements} label="Achievement progress" />
      </section>

      <section className="profile-card unlock-panel">
        <div>
          <p className="meta-subheading">Dojos</p>
          <ul>
            {DOJO_UNLOCKS.map((item) => (
              <CosmeticCard
                key={item.id}
                item={item}
                profile={rewardProfile}
                selection={cosmetics}
                onEquip={equipCosmetic}
              />
            ))}
          </ul>
        </div>
        <div>
          <p className="meta-subheading">Blades</p>
          <ul>
            {BLADE_UNLOCKS.map((item) => (
              <CosmeticCard
                key={item.id}
                item={item}
                profile={rewardProfile}
                selection={cosmetics}
                onEquip={equipCosmetic}
              />
            ))}
          </ul>
        </div>
      </section>
      <section className="profile-card">
        <SettingsControls settings={uiSettings} onChange={updateUiSettings} />
      </section>
    </GameDialog>
  )
}
