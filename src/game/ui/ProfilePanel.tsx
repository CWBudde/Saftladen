import { useRef, useState, type ReactNode } from 'react'
import type { GameMode } from '../types'
import {
  BLADE_UNLOCKS,
  DOJO_UNLOCKS,
  type CosmeticSelection,
  type CosmeticUnlock,
} from './cosmetics'
import { CosmeticCard } from './CosmeticCard'
import { GameDialog } from './GameDialog'
import { GoalList } from './GoalList'
import { MODE_NAMES } from './progression'
import { getRankInfo, type RewardProfile } from './rewards'
import { SettingsControls } from './SettingsControls'
import type { UiSettings } from './viewModel'

export type ProfileTab = 'overview' | 'goals' | 'equipment' | 'settings'
const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'goals', label: 'Goals' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'settings', label: 'Settings' },
]
type GoalCategory = 'challenges' | 'achievements' | 'objectives'
type EquipmentSlot = 'blade' | 'dojo'

function EquipmentBrowser({
  rewardProfile,
  cosmetics,
  equipCosmetic,
}: {
  rewardProfile: RewardProfile
  cosmetics: CosmeticSelection
  equipCosmetic: (item: CosmeticUnlock) => void
}) {
  const [slot, setSlot] = useState<EquipmentSlot>('blade')
  const [indices, setIndices] = useState(() => ({
    blade: Math.max(
      0,
      BLADE_UNLOCKS.findIndex((item) => item.id === cosmetics.blade),
    ),
    dojo: Math.max(
      0,
      DOJO_UNLOCKS.findIndex((item) => item.id === cosmetics.dojo),
    ),
  }))
  const items = slot === 'blade' ? BLADE_UNLOCKS : DOJO_UNLOCKS
  const index = indices[slot]
  const item = items[index]
  const move = (offset: number) =>
    setIndices((previous) => ({ ...previous, [slot]: previous[slot] + offset }))
  return (
    <section className="equipment-browser" aria-label="Equipment browser">
      <div className="profile-filter">
        <label htmlFor="equipment-slot">Browse equipment</label>
        <select
          id="equipment-slot"
          value={slot}
          onChange={(event) => setSlot(event.target.value as EquipmentSlot)}
        >
          <option value="blade">Blades</option>
          <option value="dojo">Dojos</option>
        </select>
      </div>
      <div className="equipment-navigation">
        <button
          type="button"
          className="ghost-button"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          Previous
        </button>
        <span aria-live="polite" aria-atomic="true">
          {index + 1} / {items.length}
          <span className="sr-only"> · {item.name}</span>
        </span>
        <button
          type="button"
          className="ghost-button"
          disabled={index === items.length - 1}
          onClick={() => move(1)}
        >
          Next
        </button>
      </div>
      <ul className="equipment-preview-list">
        <CosmeticCard
          item={item}
          profile={rewardProfile}
          selection={cosmetics}
          onEquip={equipCosmetic}
        />
      </ul>
    </section>
  )
}

type ProfilePanelProps = {
  rewardProfile: RewardProfile
  cosmetics: CosmeticSelection
  selectedMode: GameMode
  initialTab: ProfileTab
  liveAnnouncement: ReactNode
  uiSettings: UiSettings
  updateUiSettings: (patch: Partial<UiSettings>) => void
  equipCosmetic: (item: CosmeticUnlock) => void
  onClose: () => void
}

export function ProfilePanel({
  rewardProfile,
  cosmetics,
  selectedMode,
  initialTab,
  liveAnnouncement,
  uiSettings,
  updateUiSettings,
  equipCosmetic,
  onClose,
}: ProfilePanelProps) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [category, setCategory] = useState<GoalCategory>('challenges')
  const [achievementMode, setAchievementMode] = useState(selectedMode)
  const contentRef = useRef<HTMLDivElement>(null)
  const rankInfo = getRankInfo(rewardProfile.xp)
  const selectTab = (tab: ProfileTab) => {
    setActiveTab(tab)
    contentRef.current?.scrollTo(0, 0)
  }
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
        <button type="button" className="ghost-button" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`profile-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`profile-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => {
              let nextIndex: number
              if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length
              else if (event.key === 'ArrowLeft')
                nextIndex = (index + TABS.length - 1) % TABS.length
              else if (event.key === 'Home') nextIndex = 0
              else if (event.key === 'End') nextIndex = TABS.length - 1
              else return
              event.preventDefault()
              const nextTab = TABS[nextIndex].id
              selectTab(nextTab)
              document.getElementById(`profile-tab-${nextTab}`)?.focus({ preventScroll: true })
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="profile-content" ref={contentRef}>
        {TABS.map((tab) => (
          <div
            key={tab.id}
            id={`profile-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`profile-tab-${tab.id}`}
            hidden={activeTab !== tab.id}
            tabIndex={0}
          >
            {tab.id === 'overview' ? (
              <>
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
                  <p className="meta-subtle">Permanent cosmetic unlocks; nothing is spent.</p>
                </section>
                <section className="profile-card profile-equipped" aria-label="Equipped items">
                  <p className="meta-label">Your equipment</p>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      selectTab('equipment')
                      document.getElementById('profile-tab-equipment')?.focus()
                    }}
                  >
                    {BLADE_UNLOCKS.find((item) => item.id === cosmetics.blade)?.name}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      selectTab('equipment')
                      document.getElementById('profile-tab-equipment')?.focus()
                    }}
                  >
                    {DOJO_UNLOCKS.find((item) => item.id === cosmetics.dojo)?.name}
                  </button>
                  <p className="meta-subtle">Starfruit → blades · XP → dojos</p>
                </section>
              </>
            ) : null}
            {tab.id === 'goals' ? (
              <>
                <div className="profile-filter">
                  <label htmlFor="goal-category">Goal category</label>
                  <select
                    id="goal-category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value as GoalCategory)
                      contentRef.current?.scrollTo(0, 0)
                    }}
                  >
                    <option value="challenges">Challenges</option>
                    <option value="achievements">Mode achievements</option>
                    <option value="objectives">Starter objectives</option>
                  </select>
                </div>
                {category === 'challenges' ? (
                  <section className="profile-card" aria-label="Rotating challenges">
                    <h3>Challenge set {rewardProfile.challenges.cycle + 1} of 3</h3>
                    <p className="meta-subtle">
                      No expiry or daily streak. Progress stays until all three finish, then a fresh
                      set begins. Each challenge pays once per set.
                    </p>
                    <GoalList goals={rewardProfile.challenges.goals} label="Challenge progress" />
                  </section>
                ) : category === 'achievements' ? (
                  <section className="profile-card" aria-label="Mode achievements">
                    <div className="profile-filter">
                      <label htmlFor="achievement-mode">Achievement mode</label>
                      <select
                        id="achievement-mode"
                        value={achievementMode}
                        onChange={(event) => setAchievementMode(event.target.value as GameMode)}
                      >
                        {Object.entries(MODE_NAMES).map(([mode, name]) => (
                          <option key={mode} value={mode}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="meta-subtle">Permanent milestones with one-time rewards.</p>
                    <GoalList
                      goals={rewardProfile.achievements.filter(
                        (goal) => goal.mode === achievementMode,
                      )}
                      label="Achievement progress"
                    />
                  </section>
                ) : (
                  <section className="profile-card" aria-label="Starter objectives">
                    <h3>Starter objectives</h3>
                    <ul className="objective-list" aria-label="Objective progress">
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
                )}
              </>
            ) : null}
            {tab.id === 'equipment' ? (
              <EquipmentBrowser
                rewardProfile={rewardProfile}
                cosmetics={cosmetics}
                equipCosmetic={equipCosmetic}
              />
            ) : null}
            {tab.id === 'settings' ? (
              <section className="profile-card">
                <SettingsControls settings={uiSettings} onChange={updateUiSettings} />
              </section>
            ) : null}
          </div>
        ))}
      </div>
    </GameDialog>
  )
}
