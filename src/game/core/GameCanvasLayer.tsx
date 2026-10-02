import { useEffect, useRef } from 'react'
import { isGameDebugEnabled } from '../debug'
import type { GameEngine } from '../engine'
import { mountGameCanvas } from './gameCanvasController'

type GameCanvasLayerProps = {
  engine: GameEngine
  debugEnabled?: boolean
  sliceSensitivity?: number
  reducedMotion?: boolean
}

export function GameCanvasLayer({
  engine,
  debugEnabled = isGameDebugEnabled(),
  sliceSensitivity = 1,
  reducedMotion = false,
}: GameCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const optionsRef = useRef({ debugEnabled, sliceSensitivity, reducedMotion })

  useEffect(() => {
    optionsRef.current = { debugEnabled, sliceSensitivity, reducedMotion }
  }, [debugEnabled, sliceSensitivity, reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return mountGameCanvas(canvas, engine, () => optionsRef.current)
  }, [engine])

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Fruit slicing game canvas" />
}
