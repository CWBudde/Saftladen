import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SaftladenBrand } from './game/ui/SaftladenBrand'
import appleModeImage from './assets/apple1.png'
import arcadeModeImage from './assets/orange1.png'
import zenModeImage from './assets/melon1.png'
import './App.css'
import { createAudioService } from './game/audio'
import { gameAssets } from './game/assets'
import { GameCanvasLayer } from './game/core'
import { isGameDebugEnabled } from './game/debug'
import { GameDialog } from './game/ui/GameDialog'
import { GameHud } from './game/ui/GameHud'
import { SettingsControls } from './game/ui/SettingsControls'
import { OnboardingDialog } from './game/ui/OnboardingDialog'
import { hasSeenOnboarding, rememberOnboarding } from './game/ui/onboarding'
import { ReadyCountdown } from './game/ui/ReadyCountdown'
import { eventAnnouncement, eventSounds } from './game/ui/eventFeedback'
import { BLADE_UNLOCKS, DOJO_UNLOCKS, getCosmeticUnlock, getNewCosmeticUnlocks,
  loadCosmeticSelection, normalizeCosmeticSelection, saveCosmeticSelection, type CosmeticUnlock } from './game/ui/cosmetics'
import { CosmeticCard } from './game/ui/CosmeticCard'
import { GoalList } from './game/ui/GoalList'
import { pwaUpdates } from './game/ui/pwaUpdates'
import { getNextGoal, MODE_NAMES } from './game/ui/progression'
import { createGameEngine } from './game/engine'
import type { GameMode } from './game/types'
import {
  applyRunRewards,
  getRankInfo,
  loadRewardProfile,
  loadUiSettings,
  saveRewardProfile,
  useGameUiSnapshot,
  useUiSettings,
  type RunRewards,
  type RunSummary,
} from './game/ui'

function isPwaMode(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  if ('standalone' in navigator && (navigator as Record<string, unknown>).standalone === true) return true
  return false
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.tagName === 'BUTTON' ||
    target.tagName === 'A' ||
    target.tagName === 'INPUT' ||
    target.tagName === 'SELECT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function App() {
  const engine = useMemo(() => createGameEngine({ seed: 1, mode: 'classic' }), [])
  const audio = useMemo(() => {
    const saved = loadUiSettings()
    return createAudioService(saved.musicVolume, saved.sfxVolume)
  }, [])
  const uiSnapshot = useGameUiSnapshot(engine)
  const [debugEnabled, setDebugEnabled] = useState(() => isGameDebugEnabled())
  const [rewardProfile, setRewardProfile] = useState(() => loadRewardProfile())
  const [cosmetics, setCosmetics] = useState(() => loadCosmeticSelection(rewardProfile))
  const [newUnlocks, setNewUnlocks] = useState<CosmeticUnlock[]>([])
  const [lastRunRewards, setLastRunRewards] = useState<RunRewards | null>(null)
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic')
  const [profileOpen, setProfileOpen] = useState(false)
  const [seenOnboarding, setSeenOnboarding] = useState(hasSeenOnboarding)
  const [help, setHelp] = useState<{ mode: GameMode; launching: boolean } | null>(null)
  const [readyMode, setReadyMode] = useState<GameMode | null>(null)
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' })
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [uiSettings, updateUiSettings] = useUiSettings()
  const assets = useSyncExternalStore(gameAssets.subscribe, gameAssets.getSnapshot)
  const update = useSyncExternalStore(pwaUpdates.subscribe, pwaUpdates.getSnapshot)
  const assetsReady = assets.status === 'ready' || assets.status === 'fallback'
  const canStart = assetsReady && !update.applying
  const updateSafe = (uiSnapshot.view === 'menu' || uiSnapshot.view === 'game-over') && !help && !readyMode

  useEffect(() => {
    if (update.applying && update.canReload && updateSafe) window.location.reload()
  }, [update.applying, update.canReload, updateSafe])

  const updateNotice = update.available ? (
    <section className="update-notice" aria-label="Game update" aria-live="polite">
      <p>{update.error ? 'Update could not finish. Please try again.' : 'A new version is ready. Your saved progress will stay.'}</p>
      <button type="button" className="ghost-button" onClick={pwaUpdates.apply} disabled={update.applying}>
        {update.applying ? 'Updating…' : 'Update game'}
      </button>
    </section>
  ) : null

  const rewardProfileRef = useRef(rewardProfile)

  const rankInfo = getRankInfo(rewardProfile.xp)

  useEffect(() => { void gameAssets.load() }, [])

  useEffect(
    () => () => {
      audio.stopAll()
      engine.stop()
    },
    [audio, engine],
  )

  // PWA (installed app): try to autoplay music immediately
  useEffect(() => {
    if (!isPwaMode()) return
    audio.tryAutoPlay()
    const id = setTimeout(() => setMusicPlaying(audio.isMusicPlaying()), 300)
    return () => clearTimeout(id)
  }, [audio])

  // Unlock SFX on first user gesture (no music auto-start in normal web mode)
  useEffect(() => {
    const unlockAudio = () => {
      audio.initMuted()
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [audio])

  useEffect(() => {
    audio.setMusicVolume(uiSettings.musicVolume)
    audio.setSfxVolume(uiSettings.sfxVolume)
  }, [audio, uiSettings.musicVolume, uiSettings.sfxVolume])

  useEffect(() => {
    saveRewardProfile(rewardProfile)
  }, [rewardProfile])

  useEffect(() => {
    saveCosmeticSelection(cosmetics, rewardProfile)
  }, [cosmetics, rewardProfile])

  useEffect(() => engine.subscribeEvents((events) => {
    eventSounds(events).forEach((sound) => audio.playSfx(sound.name, sound.rate))
    const message = eventAnnouncement(events)
    let unlockMessage = ''
    for (const event of events) {
      if (event.type === 'run-start') {
        setLastRunRewards(null)
        setNewUnlocks([])
      }
      if (event.type === 'run-end') {
        const summary: RunSummary = {
          runId: event.runId,
          mode: event.mode,
          score: event.score,
          durationMs: event.durationMs,
          stats: event.stats,
        }
        const applied = applyRunRewards(rewardProfileRef.current, summary)
        const unlocked = getNewCosmeticUnlocks(rewardProfileRef.current, applied.profile)
        setNewUnlocks(unlocked)
        if (unlocked.length) unlockMessage = `Unlocked ${unlocked.map(item => item.name).join(', ')}. Equip your reward below.`
        rewardProfileRef.current = applied.profile
        setRewardProfile(applied.profile)
        setLastRunRewards(applied.rewards)
        if (applied.rewards.goalCompletions.length) unlockMessage += ` Goals completed: ${applied.rewards.goalCompletions.join(', ')}.`
        if (applied.rewards.challengesRotated) unlockMessage += ' A fresh challenge set is ready.'
      }
    }
    if (message || unlockMessage) setAnnouncement(previous => ({ id: previous.id + 1,
      text: [message, unlockMessage].filter(Boolean).join(' ') }))
  }), [audio, engine])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && uiSnapshot.phase === 'running') {
        event.preventDefault()
        engine.pause()
        return
      }

      if (isInteractiveTarget(event.target)) {
        return
      }

      if (event.code === 'Space') {
        if (uiSnapshot.phase === 'running') {
          event.preventDefault()
          engine.pause()
        } else if (uiSnapshot.phase === 'paused') {
          event.preventDefault()
          engine.resume()
        }
      }

      if (event.key.toLowerCase() === 'd') {
        setDebugEnabled((previous) => !previous)
      }

    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [engine, uiSnapshot.phase])

  const startMode = (mode: GameMode) => {
    if (!canStart) return
    audio.initMuted()
    audio.playSfx('ui-click')
    setSelectedMode(mode)
    setLastRunRewards(null)
    if (!seenOnboarding) setHelp({ mode, launching: true })
    else setReadyMode(mode)
  }

  const beginRun = useCallback(() => {
    if (!readyMode || document.hidden) return
    engine.setMode(readyMode)
    engine.start()
    setReadyMode(null)
  }, [engine, readyMode])

  const finishHelp = () => {
    rememberOnboarding()
    setSeenOnboarding(true)
    if (help?.launching) setReadyMode(help.mode)
    setHelp(null)
  }

  const handlePause = () => {
    audio.playSfx('ui-click')
    engine.pause()
  }

  const handleResume = () => {
    audio.initMuted()
    audio.playSfx('ui-click')
    engine.resume()
  }

  const handleRestart = () => {
    if (update.applying) return
    audio.initMuted()
    audio.playSfx('ui-click')
    setLastRunRewards(null)
    engine.reset()
    setReadyMode(selectedMode)
  }

  const handleReturnToMenu = () => {
    audio.playSfx('ui-click')
    setHelp(null)
    setReadyMode(null)
    engine.reset()
  }

  const nextGoal = getNextGoal(rewardProfile, selectedMode)
  const playGoal = () => {
    setProfileOpen(false)
    engine.reset()
    startMode(nextGoal.mode)
  }

  const equipCosmetic = (item: CosmeticUnlock) => {
    if (!getCosmeticUnlock(item, rewardProfile).unlocked) return
    const slot = item.metric === 'xp' ? 'dojo' : 'blade'
    setCosmetics(previous => normalizeCosmeticSelection({ ...previous, [slot]: item.id }, rewardProfile))
    audio.playSfx('ui-click')
    setAnnouncement(previous => ({ id: previous.id + 1, text: `${item.name} equipped.` }))
  }

  const openEquipment = () => {
    handleReturnToMenu()
    setProfileOpen(true)
  }

  const handleToggleMusic = () => {
    const playing = audio.toggleMusic()
    setMusicPlaying(playing)
  }

  return (
    <main className="game-root" data-reduced-motion={uiSettings.reducedMotion}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        <span key={announcement.id}>{announcement.text}</span>
      </div>
      <section className="stage-shell">
        <GameCanvasLayer engine={engine} debugEnabled={debugEnabled}
          sliceSensitivity={uiSettings.sliceSensitivity} reducedMotion={uiSettings.reducedMotion} cosmetics={cosmetics} />

        <button type="button" className="music-toggle-button" onClick={handleToggleMusic} aria-label={musicPlaying ? 'Pause music' : 'Play music'}>
          {musicPlaying ? '🔊' : '🔇'}
        </button>

        <div className="overlay-root">
          {uiSnapshot.view !== 'menu' ? (
            <GameHud snapshot={uiSnapshot} onPause={handlePause} />
          ) : null}

          {uiSnapshot.view === 'menu' ? (
            <section className="menu-home">
              <SaftladenBrand />
              {updateSafe ? updateNotice : null}

              {!assetsReady ? (
                <section className="asset-readiness" aria-label="Game artwork" aria-live="polite" aria-atomic="true">
                  {assets.status === 'error' ? (
                    <>
                      <p>Some artwork could not load. Check your connection and try again.</p>
                      <p className="asset-progress">{assets.loaded} of {assets.total} images ready</p>
                      <div className="asset-actions">
                        <button type="button" className="primary-button" onClick={() => { void gameAssets.load() }}>Retry artwork</button>
                        <button type="button" className="ghost-button" onClick={gameAssets.allowFallback}>Play with simple artwork</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Preparing game artwork…</p>
                      <progress max={assets.total} value={assets.loaded} aria-label="Artwork loading progress" />
                      <p className="asset-progress">{assets.loaded} of {assets.total} images ready</p>
                    </>
                  )}
                </section>
              ) : assets.status === 'fallback' ? (
                <p className="asset-fallback-note" role="status">Simple artwork enabled for images that could not load.</p>
              ) : null}

              <div className="ring-row">
                <button
                  type="button"
                  className={`ring-mode ring-red ${selectedMode === 'classic' ? 'selected' : ''}`}
                  disabled={!canStart}
                  onClick={() => startMode('classic')}
                  aria-describedby="classic-help"
                  data-focus-anchor
                >
                  <span className="ring-fruit">
                    <img src={appleModeImage} alt="" className="ring-fruit-image" />
                  </span>
                  <span className="ring-label">Classic</span>
                </button>
                <button
                  type="button"
                  className={`ring-mode ring-orange ${selectedMode === 'arcade' ? 'selected' : ''}`}
                  disabled={!canStart}
                  onClick={() => startMode('arcade')}
                  aria-describedby="arcade-help"
                >
                  <span className="ring-fruit">
                    <img src={arcadeModeImage} alt="" className="ring-fruit-image" />
                  </span>
                  <span className="ring-label">Arcade</span>
                </button>
                <button
                  type="button"
                  className={`ring-mode ring-green ${selectedMode === 'zen' ? 'selected' : ''}`}
                  disabled={!canStart}
                  onClick={() => startMode('zen')}
                  aria-describedby="zen-help"
                >
                  <span className="ring-fruit">
                    <img src={zenModeImage} alt="" className="ring-fruit-image" />
                  </span>
                  <span className="ring-label">Zen</span>
                </button>
              </div>

              <div className="mode-guide" aria-label="Choose a mode">
                <p id="classic-help"><strong>Classic</strong> · Three misses end the run. Avoid every bomb.</p>
                <p id="arcade-help"><strong>Arcade</strong> · 60 seconds, power-ups and score-chasing. Bombs cost points.</p>
                <p id="zen-help"><strong>Zen</strong> · 90 seconds of fruit. No bombs, no strikes.</p>
                <p className="slice-guide">Swipe across fruit with your mouse or finger. Use Space or Escape to pause.</p>
              </div>

              <div className="menu-actions">
                <button type="button" className="ghost-button help-button" aria-haspopup="dialog"
                  onClick={() => setHelp({ mode: selectedMode, launching: false })}>How to play</button>
                <button
                  type="button"
                  className="profile-button"
                  aria-haspopup="dialog"
                  aria-expanded={profileOpen}
                  onClick={() => {
                    audio.playSfx('ui-click')
                    setProfileOpen((open) => !open)
                  }}
                >
                  Profile & Rewards
                </button>
              </div>
            </section>
          ) : null}

          {help ? <OnboardingDialog mode={help.mode} launching={help.launching}
            sliceSensitivity={uiSettings.sliceSensitivity} reducedMotion={uiSettings.reducedMotion}
            onContinue={finishHelp} onDismiss={() => setHelp(null)} /> : null}

          {readyMode ? <ReadyCountdown mode={readyMode} onComplete={beginRun} onCancel={handleReturnToMenu} /> : null}

          {uiSnapshot.view === 'menu' && profileOpen ? (
            <GameDialog className="profile-panel" labelledBy="profile-heading" onDismiss={() => setProfileOpen(false)}
              returnFocusSelector=".profile-button">
              <div className="profile-heading-row">
                <h2 id="profile-heading">Profile & Rewards</h2>
                <button type="button" className="ghost-button" onClick={() => setProfileOpen(false)}>Close</button>
              </div>
              <section className="profile-card">
                <p className="meta-label">
                  {rankInfo.rankName} · Level {rankInfo.level}
                </p>
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${Math.round(rankInfo.levelProgress * 100)}%` }} />
                </div>
                <p className="meta-subtle">
                  XP {rewardProfile.xp} · Starfruit earned {rewardProfile.starfruit}
                </p>
                <p className="meta-subtle">
                  Earn Starfruit to unlock blades and XP to unlock dojos.
                  Unlocks are automatic and permanent; nothing is spent.
                  All rewards are cosmetic.
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
                      <small>Reward: {objective.rewardXp} XP · {objective.rewardStarfruit} Starfruit</small>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="profile-card" aria-label="Next goal">
                <h3>Next goal: {nextGoal.title}</h3>
                <p>{nextGoal.description} ({nextGoal.progress}/{nextGoal.target}{nextGoal.metric === 'accuracy' ? '%' : ''})</p>
                <button type="button" className="primary-button" onClick={playGoal} disabled={!canStart}>
                  Play {MODE_NAMES[nextGoal.mode]} goal
                </button>
              </section>
              <section className="profile-card" aria-label="Rotating challenges">
                <h3>Challenge set {rewardProfile.challenges.cycle + 1} of 3</h3>
                <p className="meta-subtle">No expiry or daily streak. Progress stays until all three finish,
                  then a fresh set begins. Each challenge pays once per set.</p>
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
                    {DOJO_UNLOCKS.map(item => <CosmeticCard key={item.id} item={item} profile={rewardProfile}
                      selection={cosmetics} onEquip={equipCosmetic} />)}
                  </ul>
                </div>
                <div>
                  <p className="meta-subheading">Blades</p>
                  <ul>
                    {BLADE_UNLOCKS.map(item => <CosmeticCard key={item.id} item={item} profile={rewardProfile}
                      selection={cosmetics} onEquip={equipCosmetic} />)}
                  </ul>
                </div>
              </section>
              <section className="profile-card">
                <SettingsControls settings={uiSettings} onChange={updateUiSettings} />
              </section>
            </GameDialog>
          ) : null}

          {uiSnapshot.view === 'paused' ? (
            <GameDialog className="overlay-card" labelledBy="pause-heading" onDismiss={handleResume}
              returnFocusSelector="[data-focus-anchor]:not(:disabled)">
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
          ) : null}

          {uiSnapshot.view === 'game-over' ? (
            <GameDialog className="overlay-card" labelledBy="game-over-heading" onDismiss={handleReturnToMenu}
              returnFocusSelector="[data-focus-anchor]:not(:disabled)">
              <h2 id="game-over-heading">Run Complete</h2>
              {updateSafe ? updateNotice : null}
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
                <button type="button" className="primary-button" onClick={handleRestart} disabled={update.applying}>
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
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default App
