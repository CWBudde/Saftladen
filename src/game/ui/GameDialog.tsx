import { useEffect, useRef, type ReactNode } from 'react'

type GameDialogProps = {
  children: ReactNode
  className: string
  labelledBy: string
  onDismiss: () => void
  returnFocusSelector?: string
}

/** Native dialogs keep keyboard focus inside and make the game behind them inert. */
export function GameDialog({ children, className, labelledBy, onDismiss, returnFocusSelector }: GameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      requestAnimationFrame(() => {
        const target = (returnFocusSelector ? document.querySelector<HTMLElement>(returnFocusSelector) : null)
          ?? (previousFocus instanceof HTMLElement && previousFocus.isConnected
          && !previousFocus.matches(':disabled')
          ? previousFocus
          : document.querySelector<HTMLElement>('[data-focus-anchor]:not(:disabled)'))
        target?.focus({ preventScroll: true })
      })
    }
  }, [returnFocusSelector])

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-labelledby={labelledBy}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        )
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
    >
      {children}
    </dialog>
  )
}
