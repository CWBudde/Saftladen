import type { ReactNode } from 'react'
import appleModeImage from '../../assets/apple1.png'
import arcadeModeImage from '../../assets/orange1.png'
import zenModeImage from '../../assets/melon1.png'
import type { AssetReadiness } from '../assets'
import type { GameMode } from '../types'
import { SaftladenBrand } from './SaftladenBrand'

type MenuScreenProps = {
  assets: AssetReadiness
  assetsReady: boolean
  canStart: boolean
  selectedMode: GameMode
  profileOpen: boolean
  updateNotice: ReactNode
  startMode: (mode: GameMode) => void
  onRetryArtwork: () => void
  onAllowFallback: () => void
  onOpenHelp: () => void
  onToggleProfile: () => void
}

export function MenuScreen({
  assets,
  assetsReady,
  canStart,
  selectedMode,
  profileOpen,
  updateNotice,
  startMode,
  onRetryArtwork,
  onAllowFallback,
  onOpenHelp,
  onToggleProfile,
}: MenuScreenProps) {
  return (
    <section className="menu-home">
      <SaftladenBrand />
      {updateNotice}

      {!assetsReady ? (
        <section
          className="asset-readiness"
          aria-label="Game artwork"
          aria-live="polite"
          aria-atomic="true"
        >
          {assets.status === 'error' ? (
            <>
              <p>Some artwork could not load. Check your connection and try again.</p>
              <p className="asset-progress">
                {assets.loaded} of {assets.total} images ready
              </p>
              <div className="asset-actions">
                <button type="button" className="primary-button" onClick={onRetryArtwork}>
                  Retry artwork
                </button>
                <button type="button" className="ghost-button" onClick={onAllowFallback}>
                  Play with simple artwork
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Preparing game artwork…</p>
              <progress
                max={assets.total}
                value={assets.loaded}
                aria-label="Artwork loading progress"
              />
              <p className="asset-progress">
                {assets.loaded} of {assets.total} images ready
              </p>
            </>
          )}
        </section>
      ) : assets.status === 'fallback' ? (
        <p className="asset-fallback-note" role="status">
          Simple artwork enabled for images that could not load.
        </p>
      ) : null}

      <div className="ring-row">
        <button
          type="button"
          className={`ring-mode ring-red ${selectedMode === 'classic' ? 'selected' : ''}`}
          disabled={!canStart}
          onClick={() => startMode('classic')}
          aria-describedby="classic-help"
          data-focus-anchor={selectedMode === 'classic' || undefined}
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
          data-focus-anchor={selectedMode === 'arcade' || undefined}
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
          data-focus-anchor={selectedMode === 'zen' || undefined}
        >
          <span className="ring-fruit">
            <img src={zenModeImage} alt="" className="ring-fruit-image" />
          </span>
          <span className="ring-label">Zen</span>
        </button>
      </div>

      <div className="mode-guide" aria-label="Choose a mode">
        <p id="classic-help">
          <strong>Classic</strong> · Three misses end the run. Avoid every bomb.
        </p>
        <p id="arcade-help">
          <strong>Arcade</strong> · 60 seconds, power-ups and score-chasing. Bombs cost points.
        </p>
        <p id="zen-help">
          <strong>Zen</strong> · 90 seconds of fruit. No bombs, no strikes.
        </p>
        <p className="slice-guide">
          Swipe across fruit with your mouse or finger. Use Space or Escape to pause.
        </p>
      </div>

      <div className="menu-actions">
        <button
          type="button"
          className="ghost-button help-button"
          aria-haspopup="dialog"
          onClick={onOpenHelp}
        >
          How to play
        </button>
        <button
          type="button"
          className="profile-button"
          aria-haspopup="dialog"
          aria-expanded={profileOpen}
          onClick={onToggleProfile}
        >
          Profile & Rewards
        </button>
      </div>
    </section>
  )
}
