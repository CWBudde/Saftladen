import { useEffect, useMemo, useRef, useState } from 'react'
import titleImage from './assets/title.png'
import appleModeImage from './assets/apple1.png'
import arcadeModeImage from './assets/orange1.png'
import zenModeImage from './assets/melon1.png'
import './App.css'
import { createAudioService } from './game/audio'
import { GameCanvasLayer } from './game/core'
import { isGameDebugEnabled } from './game/debug'
import { createGameEngine } from './game/engine'
import type { GameMode } from './game/types'
import {
  applyRunRewards,
  getRankInfo,
  loadRewardProfile,
  saveRewardProfile,
  useGameUiSnapshot,
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

function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
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

function powerUpLabel(powerUp: 'freeze' | 'frenzy' | 'double-points'): string {
  if (powerUp === 'freeze') {
    return 'Freeze'
  }
  if (powerUp === 'frenzy') {
    return 'Frenzy'
  }
  return 'Double'
}

function App() {
  const engine = useMemo(() => createGameEngine({ seed: 1, mode: 'classic' }), [])
  const audio = useMemo(() => createAudioService(), [])
  const uiSnapshot = useGameUiSnapshot(engine)
  const [debugEnabled, setDebugEnabled] = useState(() => isGameDebugEnabled())
  const [rewardProfile, setRewardProfile] = useState(() => loadRewardProfile())
  const [lastRunRewards, setLastRunRewards] = useState<RunRewards | null>(null)
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic')
  const [profileOpen, setProfileOpen] = useState(false)
  const [currentRunPeakCombo, setCurrentRunPeakCombo] = useState(0)

  const runPeakComboRef = useRef(0)

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

  useEffect(() => {
    const unlockAudio = () => {
      audio.initOnUserGesture()
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [audio])

  useEffect(() => {
    saveRewardProfile(rewardProfile)
  }, [rewardProfile])

  useEffect(() => {
    let previousPhase = engine.getState().phase

    return engine.subscribe((state) => {
      if (previousPhase !== 'running' && state.phase === 'running') {
        runPeakComboRef.current = state.score.combo
        setLastRunRewards(null)
      }

      if (state.phase === 'running') {
        runPeakComboRef.current = Math.max(runPeakComboRef.current, state.score.combo)
      }

      if (previousPhase === 'running' && state.phase === 'game-over') {
        const runPeakCombo = Math.max(runPeakComboRef.current, state.score.combo)
        setCurrentRunPeakCombo(runPeakCombo)
        const summary: RunSummary = {
          mode: state.mode,
          score: state.score.current,
          maxCombo: runPeakCombo,
          durationMs: state.world.elapsedMs,
          strikesRemaining: state.strikes.remaining,
          strikesMax: state.strikes.max,
        }

        setRewardProfile((previousProfile) => {
          const applied = applyRunRewards(previousProfile, summary)
          setLastRunRewards(applied.rewards)
          return applied.profile
        })
      }

      previousPhase = state.phase
    })
  }, [engine])

  useEffect(() => {
    const initialState = engine.getState()
    let previousScore = initialState.score.current
    let previousMisses = initialState.world.misses.count
    let previousBombHitAt = initialState.world.lastBombHitAtMs
    let previousPhase = initialState.phase
    let previousPowerUpKey = [
      initialState.modeState.arcade.powerUpTimers.freezeMs > 0 ? '1' : '0',
      initialState.modeState.arcade.powerUpTimers.frenzyMs > 0 ? '1' : '0',
      initialState.modeState.arcade.powerUpTimers.doublePointsMs > 0 ? '1' : '0',
    ].join('')

    return engine.subscribe((state) => {
      if (state.score.current > previousScore) {
        audio.playSfx('slice')
      }

      if (state.world.misses.count > previousMisses) {
        audio.playSfx('miss')
      }

      if (state.world.lastBombHitAtMs !== previousBombHitAt && state.world.lastBombHitAtMs !== null) {
        audio.playSfx('bomb')
      }

      if (previousPhase !== 'game-over' && state.phase === 'game-over') {
        audio.playSfx('game-over')
      }

      const currentPowerUpKey = [
        state.modeState.arcade.powerUpTimers.freezeMs > 0 ? '1' : '0',
        state.modeState.arcade.powerUpTimers.frenzyMs > 0 ? '1' : '0',
        state.modeState.arcade.powerUpTimers.doublePointsMs > 0 ? '1' : '0',
      ].join('')
      if (currentPowerUpKey !== previousPowerUpKey && currentPowerUpKey.includes('1')) {
        audio.playSfx('power-up')
      }

      previousScore = state.score.current
      previousMisses = state.world.misses.count
      previousBombHitAt = state.world.lastBombHitAtMs
      previousPhase = state.phase
      previousPowerUpKey = currentPowerUpKey
    })
  }, [audio, engine])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFormTarget(event.target)) {
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

      if (event.key === 'Escape' && uiSnapshot.phase === 'running') {
        event.preventDefault()
        engine.pause()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [engine, uiSnapshot.phase])

  const startMode = (mode: GameMode) => {
    audio.initOnUserGesture()
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
    audio.initOnUserGesture()
    audio.playSfx('ui-click')
    engine.resume()
  }

  const handleRestart = () => {
    audio.initOnUserGesture()
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

  return (
    <main className="game-root">
      <section className="stage-shell">
        <GameCanvasLayer engine={engine} debugEnabled={debugEnabled} />

        <div className="overlay-root">
          {uiSnapshot.view !== 'menu' ? (
            <div className="hud-bar" role="status" aria-live="polite">
              <p className="hud-pill">Score {uiSnapshot.score}</p>
              <p className="hud-pill">Combo x{Math.max(1, uiSnapshot.combo)}</p>
              <p className="hud-pill">Mode {uiSnapshot.mode}</p>
              {uiSnapshot.mode === 'arcade' ? (
                <p className="hud-pill">Time {formatDuration(uiSnapshot.arcadeRemainingMs)}</p>
              ) : uiSnapshot.mode === 'zen' ? (
                <p className="hud-pill">Time {formatDuration(uiSnapshot.zenRemainingMs)}</p>
              ) : (
                <p className="hud-pill">
                  Strikes {uiSnapshot.strikesRemaining}/{uiSnapshot.strikesMax}
                </p>
              )}
              <p className="hud-pill">Starfruit {rewardProfile.starfruit}</p>
              {uiSnapshot.mode === 'arcade'
                ? uiSnapshot.activePowerUps.map((powerUp) => (
                    <p key={powerUp} className="hud-pill power-up-pill">
                      {powerUpLabel(powerUp)}
                    </p>
                  ))
                : null}
              <button type="button" className="ghost-button" onClick={handlePause} disabled={uiSnapshot.view !== 'playing'}>
                Pause
              </button>
            </div>
          ) : null}

          {uiSnapshot.view === 'menu' ? (
            <section className="menu-home">
              <img src={titleImage} className="menu-logo" alt="Saftladen" />

              <div className="ring-row">
                <button
                  type="button"
                  className={`ring-mode ring-red ${selectedMode === 'classic' ? 'selected' : ''}`}
                  onClick={() => startMode('classic')}
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
                >
                  <span className="ring-fruit">
                    <img src={zenModeImage} alt="" className="ring-fruit-image" />
                  </span>
                  <span className="ring-label">Zen</span>
                </button>
              </div>

              <div className="menu-actions">
                <button
                  type="button"
                  className="profile-button"
                  onClick={() => {
                    audio.playSfx('ui-click')
                    setProfileOpen((open) => !open)
                  }}
                >
                  Profile & Rewards
                </button>
              </div>

              {profileOpen ? (
                <aside className="profile-panel">
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
                          <li key={dojo.name}>{dojo.unlocked ? 'Unlocked' : dojo.requirement}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="meta-subheading">Blades</p>
                      <ul>
                        {blades.map((blade) => (
                          <li key={blade.name}>{blade.unlocked ? 'Unlocked' : blade.requirement}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                </aside>
              ) : null}
            </section>
          ) : null}

          {uiSnapshot.view === 'paused' ? (
            <section className="overlay-card" aria-labelledby="pause-heading">
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
            </section>
          ) : null}

          {uiSnapshot.view === 'game-over' ? (
            <section className="overlay-card" aria-labelledby="game-over-heading">
              <h2 id="game-over-heading">Run Complete</h2>
              <p>
                Score {uiSnapshot.score} · Best {uiSnapshot.bestScore}
              </p>
              <p>
                Peak Combo x{Math.max(1, currentRunPeakCombo)} · Time {formatDuration(uiSnapshot.elapsedMs)}
              </p>
              {lastRunRewards ? (
                <div className="reward-strip">
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
            </section>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default App
