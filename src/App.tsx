import { useEffect, useMemo, useRef, useState } from 'react'
import titleImage from './assets/title.png'
import appleModeImage from './assets/apple1.png'
import arcadeModeImage from './assets/orange1.png'
import zenModeImage from './assets/melon1.png'
import './App.css'
import { createAudioService } from './game/audio'
import { GameCanvasLayer } from './game/core'
import { isGameDebugEnabled } from './game/debug'
import { GameDialog } from './game/ui/GameDialog'
import { GameHud } from './game/ui/GameHud'
import { SettingsControls } from './game/ui/SettingsControls'
import { eventAnnouncement, eventSounds } from './game/ui/eventFeedback'
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

type Unlockable = {
  name: string
  requirement: string
  unlocked: boolean
}

const DOJO_UNLOCKS = [
  { name: 'Great Wave Dojo', level: 1 },
  { name: 'Sunset Harbor Dojo', level: 3 },
  { name: 'Storm Temple Dojo', level: 5 },
]

const BLADE_UNLOCKS = [
  { name: 'Bamboo Blade', starfruit: 0 },
  { name: 'Comet Blade', starfruit: 40 },
  { name: 'Dragon Fang', starfruit: 110 },
]

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
  const [lastRunRewards, setLastRunRewards] = useState<RunRewards | null>(null)
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic')
  const [profileOpen, setProfileOpen] = useState(false)
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' })
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [uiSettings, updateUiSettings] = useUiSettings()

  const rewardProfileRef = useRef(rewardProfile)

  const rankInfo = getRankInfo(rewardProfile.xp)

  const dojos: Unlockable[] = DOJO_UNLOCKS.map((dojo) => ({
    name: dojo.name,
    requirement: `Level ${dojo.level}`,
    unlocked: rankInfo.level >= dojo.level,
  }))

  const blades: Unlockable[] = BLADE_UNLOCKS.map((blade) => ({
    name: blade.name,
    requirement: `${blade.starfruit} starfruit`,
    unlocked: rewardProfile.starfruit >= blade.starfruit,
  }))

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

  useEffect(() => engine.subscribeEvents((events) => {
    eventSounds(events).forEach((sound) => audio.playSfx(sound))
    const message = eventAnnouncement(events)
    if (message) setAnnouncement((previous) => ({ id: previous.id + 1, text: message }))
    for (const event of events) {
      if (event.type === 'run-start') setLastRunRewards(null)
      if (event.type === 'run-end') {
        const summary: RunSummary = {
          runId: event.runId,
          mode: event.mode,
          score: event.score,
          durationMs: event.durationMs,
          stats: event.stats,
        }
        const applied = applyRunRewards(rewardProfileRef.current, summary)
        rewardProfileRef.current = applied.profile
        setRewardProfile(applied.profile)
        setLastRunRewards(applied.rewards)
      }
    }
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
    audio.initMuted()
    audio.playSfx('ui-click')
    setSelectedMode(mode)
    setLastRunRewards(null)
    engine.setMode(mode)
    engine.start()
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
    audio.initMuted()
    audio.playSfx('ui-click')
    setLastRunRewards(null)
    engine.reset()
    engine.start()
  }

  const handleReturnToMenu = () => {
    audio.playSfx('ui-click')
    engine.reset()
  }

  const nextObjective = rewardProfile.objectives.find((objective) => !objective.completed) ?? null

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
          sliceSensitivity={uiSettings.sliceSensitivity} reducedMotion={uiSettings.reducedMotion} />

        <button type="button" className="music-toggle-button" onClick={handleToggleMusic} aria-label={musicPlaying ? 'Pause music' : 'Play music'}>
          {musicPlaying ? '🔊' : '🔇'}
        </button>

        <div className="overlay-root">
          {uiSnapshot.view !== 'menu' ? (
            <GameHud snapshot={uiSnapshot} onPause={handlePause} />
          ) : null}

          {uiSnapshot.view === 'menu' ? (
            <section className="menu-home">
              <img src={titleImage} className="menu-logo" alt="Saftladen" />

              <div className="ring-row">
                <button
                  type="button"
                  className={`ring-mode ring-red ${selectedMode === 'classic' ? 'selected' : ''}`}
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
                  XP {rewardProfile.xp} · Starfruit {rewardProfile.starfruit}
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
                    </li>
                  ))}
                </ul>
              </section>

              <section className="profile-card unlock-panel">
                <div>
                  <p className="meta-subheading">Dojos</p>
                  <ul>
                    {dojos.map((dojo) => (
                      <li key={dojo.name}><strong>{dojo.name}</strong><span>{dojo.unlocked ? 'Unlocked' : dojo.requirement}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="meta-subheading">Blades</p>
                  <ul>
                    {blades.map((blade) => (
                      <li key={blade.name}><strong>{blade.name}</strong><span>{blade.unlocked ? 'Unlocked' : blade.requirement}</span></li>
                    ))}
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
              <p>
                Score {uiSnapshot.score} · Best {uiSnapshot.bestScore}
              </p>
              <p>
                Peak Streak x{uiSnapshot.stats.peakCombo} · Time {formatDuration(uiSnapshot.elapsedMs)}
              </p>
              <dl className="result-stats">
                <div><dt>Fruit sliced</dt><dd>{uiSnapshot.stats.fruitSliced}</dd></div>
                <div><dt>Misses</dt><dd>{uiSnapshot.stats.missedFruits}</dd></div>
                <div><dt>Bomb hits</dt><dd>{uiSnapshot.stats.bombHits}</dd></div>
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
                </div>
              ) : null}
              {nextObjective ? (
                <p className="next-objective">
                  Next Objective: {nextObjective.title} ({Math.min(nextObjective.progress, nextObjective.target)}/
                  {nextObjective.target})
                </p>
              ) : (
                <p className="next-objective">All objectives completed.</p>
              )}
              <div className="overlay-actions">
                <button type="button" className="primary-button" onClick={handleRestart}>
                  Run Again
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
