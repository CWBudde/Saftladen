import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameMode } from '../types'
import { GameDialog } from './GameDialog'

/** The engine stays idle until this foreground-only preparation finishes. */
export function ReadyCountdown({ mode, onComplete, onCancel }: {
  mode: GameMode
  onComplete: () => void
  onCancel: () => void
}) {
  const [remaining, setRemaining] = useState(3)
  const [suspended, setSuspended] = useState(() => document.hidden || !document.hasFocus())
  const foreground = useRef(!document.hidden && document.hasFocus())
  const finished = useRef(false)
  const complete = useCallback(() => {
    if (finished.current || !foreground.current || document.hidden) return
    finished.current = true
    onComplete()
  }, [onComplete])

  useEffect(() => {
    const suspend = () => {
      foreground.current = false
      setSuspended(true)
    }
    const onVisibility = () => { if (document.hidden) suspend() }
    window.addEventListener('blur', suspend)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', suspend)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (suspended) return
    const timer = window.setTimeout(() => {
      if (!foreground.current || document.hidden) return
      if (remaining > 1) setRemaining(remaining - 1)
      else complete()
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [remaining, suspended, complete])

  return (
    <GameDialog className="overlay-card ready-card" labelledBy="ready-heading" onDismiss={onCancel}
      returnFocusSelector="[data-focus-anchor]:not(:disabled)">
      <h2 id="ready-heading">Ready for {mode[0].toUpperCase() + mode.slice(1)}?</h2>
      <p role="status">{suspended ? 'Countdown paused. Continue when you are ready.' : 'Starting in 3 seconds. Get ready to swipe.'}</p>
      <p className="ready-number" aria-hidden="true">{suspended ? 'Ready?' : remaining}</p>
      <div className="overlay-actions">
        {suspended ? (
          <button type="button" className="primary-button" onClick={() => {
            if (document.hidden) return
            foreground.current = true
            setSuspended(false)
          }}>Continue countdown</button>
        ) : <button type="button" className="primary-button" onClick={complete}>Start now</button>}
        <button type="button" className="ghost-button" onClick={onCancel}>Back to menu</button>
      </div>
    </GameDialog>
  )
}
