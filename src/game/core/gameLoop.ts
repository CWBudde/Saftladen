export type FrameInfo = {
  frame: number
  timestampMs: number
  deltaMs: number
  elapsedMs: number
}

export type GameLoop = {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

type LoopHandlers = {
  onFrame: (frame: FrameInfo) => void
}

const MAX_DELTA_MS = 100

export function createGameLoop({ onFrame }: LoopHandlers): GameLoop {
  let animationFrameId = 0
  let running = false
  let startTimestampMs = 0
  let previousTimestampMs = 0
  let frame = 0

  const tick = (timestampMs: number) => {
    if (!running) {
      return
    }

    if (startTimestampMs === 0) {
      startTimestampMs = timestampMs
      previousTimestampMs = timestampMs
    }

    frame += 1
    const deltaMs = Math.min(timestampMs - previousTimestampMs, MAX_DELTA_MS)
    const elapsedMs = timestampMs - startTimestampMs
    previousTimestampMs = timestampMs

    onFrame({
      frame,
      timestampMs,
      deltaMs,
      elapsedMs,
    })

    animationFrameId = window.requestAnimationFrame(tick)
  }

  const start = () => {
    if (running) {
      return
    }

    running = true
    animationFrameId = window.requestAnimationFrame(tick)
  }

  const stop = () => {
    if (!running) {
      return
    }

    running = false
    window.cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
    startTimestampMs = 0
    previousTimestampMs = 0
    frame = 0
  }

  const isRunning = () => running

  return {
    start,
    stop,
    isRunning,
  }
}
