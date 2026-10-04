import { useEffect, useRef, useState } from 'react'
import { mountPracticeCanvas, type PracticeFeedback } from '../core/practiceCanvasController'

type PracticeSwipeProps = { sliceSensitivity: number; reducedMotion: boolean }

const FEEDBACK: Record<PracticeFeedback, string> = {
  ready: 'Swipe across the apple.',
  success: 'Nice slice! Ready for the game.',
  miss: 'Try again: swipe across the apple.',
  unavailable: 'Practice canvas is unavailable. You can still read the instructions and continue.',
}

export function PracticeSwipe({ sliceSensitivity, reducedMotion }: PracticeSwipeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const controllerRef = useRef<ReturnType<typeof mountPracticeCanvas> | null>(null)
  const preferencesRef = useRef({ sliceSensitivity, reducedMotion })
  const [feedback, setFeedback] = useState<PracticeFeedback>('ready')

  useEffect(() => {
    preferencesRef.current = { sliceSensitivity, reducedMotion }
    controllerRef.current?.refresh()
  }, [sliceSensitivity, reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const controller = mountPracticeCanvas(canvas, () => preferencesRef.current, setFeedback)
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [])

  return (
    <section className="practice-swipe" aria-label="Safe slicing practice">
      <canvas ref={canvasRef} className="practice-canvas" aria-label="Practice slicing canvas" />
      <p className="practice-feedback" role="status" aria-live="polite" aria-atomic="true">
        {FEEDBACK[feedback]}
      </p>
      <button
        type="button"
        className="ghost-button"
        onClick={() => controllerRef.current?.reset()}
        disabled={feedback === 'unavailable'}
      >
        Practice again
      </button>
    </section>
  )
}
