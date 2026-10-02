import { expect, mock, test } from 'bun:test'
import { createGameEngine } from '../src/game/engine/gameEngine'
import { createFruitEntity } from '../src/game/model/entities'

// Exercise the real controller/engine/input pipeline without a GPU or a DOM.
mock.module('../src/game/render/index.ts', () => ({
  createRenderer: () => ({ render: () => {} }),
}))
const { mountGameCanvas } = await import('../src/game/core/gameCanvasController')

test('canvas queues release before stepping, caches layout and pauses on blur', () => {
  const savedGlobals = ['window', 'document', 'ResizeObserver'].map((name) => ({
    name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name),
  }))
  const listeners = new Map<string, EventListener>()
  let frame: FrameRequestCallback | undefined
  let rectReads = 0
  const listen = (prefix: string) => ({
    addEventListener: (name: string, listener: EventListener) => listeners.set(`${prefix}:${name}`, listener),
    removeEventListener: (name: string) => listeners.delete(`${prefix}:${name}`),
  })
  const context = { setTransform: () => {} }
  const canvas = {
    ...listen('canvas'), width: 0, height: 0, clientWidth: 1280, clientHeight: 720,
    getContext: () => context,
    getBoundingClientRect: () => {
      rectReads += 1
      return { left: 0, top: 0, width: 1280, height: 720 }
    },
    setPointerCapture: () => {},
  } as unknown as HTMLCanvasElement
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    ...listen('window'), devicePixelRatio: 1,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frame = callback; return 1 },
    cancelAnimationFrame: () => { frame = undefined },
  } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    ...listen('document'), hidden: false,
  } })
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class {
    observe() {}
    disconnect() {}
  } })

  let dispose: (() => void) | undefined
  try {
    const engine = createGameEngine({ seed: 1 })
    engine.start()
    engine.getState().world.spawn.nextWaveAtMs = Infinity
    const addFruit = () => {
      const fruit = createFruitEntity({
        fruitType: 'apple', color: '#ef4444', position: { x: 500, y: 300 },
        velocity: { x: 0, y: 0 }, radius: 30,
        rotationRad: 0, angularVelocityRadPerS: 0,
      })
      engine.getState().world.entities[fruit.id] = fruit
      return fruit
    }
    const runFrame = (timestamp: number) => {
      expect(frame).toBeDefined()
      frame!(timestamp)
    }
    const pointer = (name: string, x: number, timestamp: number) => {
      listeners.get(`canvas:${name}`)?.({
        pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: 300, timeStamp: timestamp,
      } as unknown as Event)
    }
    dispose = mountGameCanvas(canvas, engine, () => ({ debugEnabled: false, sliceSensitivity: 1, reducedMotion: false }))
    addFruit()
    runFrame(100)
    pointer('pointerdown', 400, 101)
    pointer('pointermove', 600, 110)
    pointer('pointerup', 600, 112)
    const measuredAtGesture = rectReads
    runFrame(117)
    expect(engine.getState().score.current).toBe(10)
    const laterFruit = addFruit()
    runFrame(134)
    expect(engine.getState().world.entities[laterFruit.id]).toBeDefined()
    expect(rectReads).toBe(measuredAtGesture)

    pointer('pointerdown', 400, 135)
    pointer('pointermove', 600, 140)
    listeners.get('window:blur')?.({} as Event)
    expect(engine.getState().phase).toBe('paused')
    engine.resume()
    runFrame(151)
    expect(engine.getState().score.current).toBe(10)
    dispose()
    dispose = undefined
    expect(listeners.size).toBe(0)
    expect(frame).toBeUndefined()
  } finally {
    dispose?.()
    for (const { name, descriptor } of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
})
