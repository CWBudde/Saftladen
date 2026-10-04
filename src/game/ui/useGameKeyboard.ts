import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { GameEngine } from '../engine'
import type { GamePhase } from '../types'

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

export function useGameKeyboard(
  engine: GameEngine,
  phase: GamePhase,
  setDebugEnabled: Dispatch<SetStateAction<boolean>>,
) {
  const heldPauseShortcut = useRef<'Space' | 'Escape' | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === heldPauseShortcut.current) {
        event.preventDefault()
        return
      }
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return

      if (event.key === 'Escape' && phase === 'running') {
        event.preventDefault()
        heldPauseShortcut.current = 'Escape'
        engine.pause()
        return
      }

      if (isInteractiveTarget(event.target)) {
        return
      }

      if (event.code === 'Space') {
        if (phase === 'running') {
          event.preventDefault()
          heldPauseShortcut.current = 'Space'
          engine.pause()
        } else if (phase === 'paused') {
          event.preventDefault()
          heldPauseShortcut.current = 'Space'
          engine.resume()
        }
      }

      if (event.key.toLowerCase() === 'd') {
        setDebugEnabled((previous) => !previous)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== heldPauseShortcut.current) return
      // Modal autofocus moves to Resume during this press. Repeats and keyup
      // must not dismiss it; the next deliberate press uses native behavior.
      event.preventDefault()
      heldPauseShortcut.current = null
    }
    const onBlur = () => {
      heldPauseShortcut.current = null
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [engine, phase, setDebugEnabled])
}
