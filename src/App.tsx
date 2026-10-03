import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import './App.css'
import { createAudioService } from './game/audio'
import { gameAssets } from './game/assets'
import { GameCanvasLayer } from './game/core'
import { isGameDebugEnabled } from './game/debug'
import { GameHud } from './game/ui/GameHud'
import { MenuScreen } from './game/ui/MenuScreen'
import { ProfilePanel } from './game/ui/ProfilePanel'
import { PauseOverlay } from './game/ui/PauseOverlay'
import { GameOverOverlay } from './game/ui/GameOverOverlay'
import { useGameKeyboard } from './game/ui/useGameKeyboard'
import { OnboardingDialog } from './game/ui/OnboardingDialog'
import { hasSeenOnboarding, rememberOnboarding } from './game/ui/onboarding'
import { ReadyCountdown } from './game/ui/ReadyCountdown'
import { eventAnnouncement, eventSounds } from './game/ui/eventFeedback'
import { getCosmeticUnlock, getNewCosmeticUnlocks,
  loadCosmeticSelection, normalizeCosmeticSelection, saveCosmeticSelection, type CosmeticUnlock } from './game/ui/cosmetics'
import { pwaUpdates } from './game/ui/pwaUpdates'
import { getNextGoal } from './game/ui/progression'
import { createGameEngine } from './game/engine'
import type { GameMode } from './game/types'
import {
  applyRunRewards,
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

  useGameKeyboard(engine, uiSnapshot.phase, setDebugEnabled)

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

  const liveAnnouncement = (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      <span key={announcement.id}>{announcement.text}</span>
    </div>
  )

  return (
    <main className="game-root" data-reduced-motion={uiSettings.reducedMotion}>
      {uiSnapshot.view !== 'game-over' && !(uiSnapshot.view === 'menu' && profileOpen) ? liveAnnouncement : null}
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
            <MenuScreen assets={assets} assetsReady={assetsReady} canStart={canStart}
              selectedMode={selectedMode} profileOpen={profileOpen} updateNotice={updateSafe ? updateNotice : null}
              startMode={startMode} onRetryArtwork={() => { void gameAssets.load() }} onAllowFallback={gameAssets.allowFallback}
              onOpenHelp={() => setHelp({ mode: selectedMode, launching: false })}
              onToggleProfile={() => {
                audio.playSfx('ui-click')
                setProfileOpen((open) => !open)
              }} />
          ) : null}

          {help ? <OnboardingDialog mode={help.mode} launching={help.launching}
            sliceSensitivity={uiSettings.sliceSensitivity} reducedMotion={uiSettings.reducedMotion}
            onContinue={finishHelp} onDismiss={() => setHelp(null)} /> : null}

          {readyMode ? <ReadyCountdown mode={readyMode} onComplete={beginRun} onCancel={handleReturnToMenu} /> : null}

          {uiSnapshot.view === 'menu' && profileOpen ? (
            <ProfilePanel rewardProfile={rewardProfile} cosmetics={cosmetics} nextGoal={nextGoal} canStart={canStart}
              liveAnnouncement={liveAnnouncement} uiSettings={uiSettings} updateUiSettings={updateUiSettings}
              equipCosmetic={equipCosmetic} playGoal={playGoal} onClose={() => setProfileOpen(false)} />
          ) : null}

          {uiSnapshot.view === 'paused' ? (
            <PauseOverlay uiSnapshot={uiSnapshot} uiSettings={uiSettings} updateUiSettings={updateUiSettings}
              handleResume={handleResume} handleRestart={handleRestart} handleReturnToMenu={handleReturnToMenu} />
          ) : null}

          {uiSnapshot.view === 'game-over' ? (
            <GameOverOverlay uiSnapshot={uiSnapshot} rewardProfile={rewardProfile} lastRunRewards={lastRunRewards}
              newUnlocks={newUnlocks} cosmetics={cosmetics} selectedMode={selectedMode} nextGoal={nextGoal}
              canStart={canStart} updating={update.applying} liveAnnouncement={liveAnnouncement}
              updateNotice={updateSafe ? updateNotice : null} equipCosmetic={equipCosmetic} playGoal={playGoal}
              handleRestart={handleRestart} openEquipment={openEquipment} handleReturnToMenu={handleReturnToMenu} />
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default App
