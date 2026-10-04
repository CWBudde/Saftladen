import { useEffect, useRef } from 'react'
import { isGameDebugEnabled } from '../debug'
import type { GameEngine } from '../engine'
import { mountGameCanvas } from './gameCanvasController'
import { DEFAULT_COSMETIC_SELECTION, type CosmeticSelection } from '../ui/cosmetics'

type GameCanvasLayerProps = {
  engine: GameEngine
  debugEnabled?: boolean
  sliceSensitivity?: number
  reducedMotion?: boolean
  cosmetics?: CosmeticSelection
}

export function GameCanvasLayer({
  engine,
  debugEnabled = isGameDebugEnabled(),
  sliceSensitivity = 1,
  reducedMotion = false,
  cosmetics = DEFAULT_COSMETIC_SELECTION,
}: GameCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const optionsRef = useRef({ debugEnabled, sliceSensitivity, reducedMotion, cosmetics })

  useEffect(() => {
    optionsRef.current = { debugEnabled, sliceSensitivity, reducedMotion, cosmetics }
  }, [debugEnabled, sliceSensitivity, reducedMotion, cosmetics])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return mountGameCanvas(canvas, engine, () => optionsRef.current)
  }, [engine])

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      aria-label="Fruit slicing game canvas"
      data-blade={cosmetics.blade}
      data-dojo={cosmetics.dojo}
    />
  )
}
