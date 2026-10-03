import { expect, test } from 'bun:test'
import { mountPracticeCanvas, type PracticeFeedback, type PracticePreferences } from '../src/game/core/practiceCanvasController'

function fixture(run: (practice: {
  feedback: PracticeFeedback[]
  pointer: (name: string, x: number, y: number, timeStamp: number, extra?: object) => void
  fire: (name: string) => void
  reset: () => void
  setSize: (width: number, height: number, dpr: number) => void
  setViewport: (width: number, height: number) => void
  canvas: HTMLCanvasElement
  preferences: PracticePreferences
  listeners: Map<string, EventListener>
}) => void) {
  const globals = ['window', 'document', 'ResizeObserver'].map((name) => ({ name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name) }))
  const listeners = new Map<string, EventListener>()
  const listen = (prefix: string) => ({
    addEventListener: (name: string, listener: EventListener) => listeners.set(`${prefix}:${name}`, listener),
    removeEventListener: (name: string) => listeners.delete(`${prefix}:${name}`),
  })
  let width = 300
  let height = 200
  let dpr = 1
  const preferences = { sliceSensitivity: 1, reducedMotion: false }
  const feedback: PracticeFeedback[] = []
  let disconnected = false
  // Any drawing method is harmless; requestAnimationFrame deliberately does not exist.
  const ctx = new Proxy({}, { get: () => () => {} })
  const canvas = {
    ...listen('canvas'), width: 0, height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 20, top: 30, width, height }),
    setPointerCapture: () => {}, releasePointerCapture: () => {},
  } as unknown as HTMLCanvasElement
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    ...listen('window'), innerWidth: 720, innerHeight: 1280, get devicePixelRatio() { return dpr },
  } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { ...listen('document'), hidden: false } })
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class {
    observe() {}
    disconnect() { disconnected = true }
  } })
  let controller: ReturnType<typeof mountPracticeCanvas> | undefined
  try {
    controller = mountPracticeCanvas(canvas, () => preferences, (value) => feedback.push(value))
    run({
      feedback, preferences, canvas, listeners,
      pointer: (name, x, y, timeStamp, extra = {}) => listeners.get(`canvas:${name}`)?.({
        pointerId: 1, pointerType: 'mouse', button: 0, clientX: x + 20, clientY: y + 30, timeStamp, ...extra,
      } as unknown as Event),
      fire: (name) => listeners.get(name)?.({} as Event),
      reset: controller.reset,
      setSize: (nextWidth, nextHeight, nextDpr) => { width = nextWidth; height = nextHeight; dpr = nextDpr },
      setViewport: (nextWidth, nextHeight) => { window.innerWidth = nextWidth; window.innerHeight = nextHeight },
    })
    controller.dispose()
    controller.dispose()
    expect(listeners.size).toBe(0)
    expect(disconnected).toBe(true)
  } finally {
    controller?.dispose()
    for (const { name, descriptor } of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
}

test('practice ignores stationary holds, accepts release movement without a frame, and repeats safely', () => fixture(({ pointer, feedback, reset }) => {
  pointer('pointerdown', 150, 100, 0)
  pointer('pointerup', 150, 100, 20)
  expect(feedback).toEqual(['miss'])
  pointer('pointerdown', 50, 100, 30)
  pointer('pointerup', 250, 100, 40)
  expect(feedback).toEqual(['miss', 'success'])
  pointer('pointerdown', 50, 100, 50)
  pointer('pointerup', 250, 100, 60)
  expect(feedback).toEqual(['miss', 'success'])
  reset()
  expect(feedback.at(-1)).toBe('ready')
  pointer('pointerdown', 50, 100, 70)
  pointer('pointerup', 250, 100, 80)
  expect(feedback.filter((value) => value === 'success')).toHaveLength(2)
}))

test('practice uses coalesced raw samples rather than the outer event endpoint', () => fixture(({ pointer, feedback }) => {
  pointer('pointerdown', 50, 100, 0)
  pointer('pointermove', 50, 100, 20, { getCoalescedEvents: () => [
    { clientX: 270, clientY: 130, timeStamp: 10 },
    { clientX: 70, clientY: 130, timeStamp: 20 },
  ] })
  expect(feedback).toEqual(['success'])
  pointer('pointerup', 50, 100, 30)
  expect(feedback).toHaveLength(1)
}))

test('practice shares sensitivity thresholds and rejects secondary mouse buttons', () => fixture(({ pointer, feedback, preferences }) => {
  pointer('pointerdown', 50, 100, 0, { button: 2 })
  pointer('pointerup', 250, 100, 10)
  expect(feedback).toEqual([])
  preferences.sliceSensitivity = 0.5
  pointer('pointerdown', 150, 100, 20)
  pointer('pointerup', 160, 100, 120)
  expect(feedback).toEqual(['miss'])
  preferences.sliceSensitivity = 2
  pointer('pointerdown', 150, 100, 130)
  pointer('pointerup', 160, 100, 230)
  expect(feedback).toEqual(['miss', 'success'])
}))

test('cancel, blur and resize discard gestures; DPR resize redraws a fresh target', () => fixture(({ pointer, feedback, fire, setSize, canvas }) => {
  pointer('pointerdown', 50, 100, 0)
  pointer('pointercancel', 50, 100, 10)
  pointer('pointerup', 250, 100, 20)
  expect(feedback).toEqual([])
  pointer('pointerdown', 50, 100, 30)
  fire('window:blur')
  pointer('pointerup', 250, 100, 40)
  expect(feedback).toEqual([])
  pointer('pointerdown', 50, 100, 50)
  setSize(400, 180, 2)
  fire('window:resize')
  expect(canvas.width).toBe(800)
  expect(canvas.height).toBe(360)
  pointer('pointerup', 350, 90, 60)
  expect(feedback).toEqual([])
  pointer('pointerdown', 50, 90, 70)
  pointer('pointerup', 350, 90, 80)
  expect(feedback).toEqual(['success'])
}))

test('practice scales the velocity threshold to the real playfield on phones', () => fixture(({ pointer, feedback, setViewport }) => {
  pointer('pointerdown', 150, 100, 0)
  pointer('pointerup', 160, 100, 100)
  expect(feedback).toEqual(['miss'])
  setViewport(360, 780)
  pointer('pointerdown', 150, 100, 110)
  pointer('pointerup', 160, 100, 210)
  expect(feedback).toEqual(['miss', 'success'])
}))
