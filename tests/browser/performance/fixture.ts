import { gameAssets } from '../../../src/game/assets'
import { createGameEngine } from '../../../src/game/engine'
import {
  createFruitEntity,
  createFruitHalfEntity,
  createParticleEntity,
  createDecalEntity,
} from '../../../src/game/model'
import { createRenderer, type RenderContext } from '../../../src/game/render/renderer'
import type { DojoId } from '../../../src/game/ui/cosmetics'

export type ProfileSample = {
  cpuMs: number[]
  intervalsMs: number[]
  unchanged: boolean
  frames: number
}
declare global {
  interface Window {
    profileRenderer: (dojo: DojoId, stress: boolean, frames: number) => Promise<ProfileSample>
  }
}

await gameAssets.load()
if (gameAssets.getSnapshot().status !== 'ready')
  throw new Error('Profiling requires decoded production artwork')

window.profileRenderer = async (dojo, stress, frames) => {
  const canvas = document.querySelector('canvas')!
  const ctx = canvas.getContext('2d')!
  const width = innerWidth,
    height = innerHeight,
    dpr = devicePixelRatio
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const engine = createGameEngine({ seed: 17, mode: 'arcade' })
  engine.setWorldBounds({ x: width, y: height })
  engine.start()
  // Synthetic, stationary render load, deliberately separate from game balance.
  // Frenzy's fruit ceiling plus simultaneous juice, fragments, decals and two trails.
  const state = engine.getState()
  if (stress) {
    for (let i = 0; i < 322; i++) {
      const motion = {
        position: { x: 25 + ((i * 73) % (width - 50)), y: 130 + ((i * 97) % (height - 160)) },
        velocity: { x: 120, y: 80 },
        radius: i < 70 ? 18 : 3,
        rotationRad: i * 0.1,
        angularVelocityRadPerS: 0,
        color: '#ffb544',
      }
      const entity =
        i < 30
          ? createFruitEntity({ ...motion, fruitType: 'orange' })
          : i < 70
            ? createFruitHalfEntity({
                ...motion,
                fruitType: 'orange',
                half: i % 2 ? 'left' : 'right',
                sourceFruitId: 'entity_1',
                lifetimeMs: 800,
              })
            : i < 82
              ? createDecalEntity({ ...motion, lifetimeMs: 1800, maxRadius: 32 })
              : createParticleEntity({ ...motion, lifetimeMs: 600 })
      state.world.entities[entity.id] = entity
    }
  }
  const context: RenderContext = {
    metrics: {
      widthCssPx: width,
      heightCssPx: height,
      widthDevicePx: canvas.width,
      heightDevicePx: canvas.height,
      dpr,
    },
    cosmetics: { blade: 'comet', dojo },
    reducedMotion: false,
    debug: {
      enabled: false,
      diagnostics: engine.getDiagnostics(),
      lastPointerCanvas: null,
      lastPointerWorld: null,
      trails: stress
        ? [1, 2].map((pointerId) => ({
            pointerId,
            worldPoints: [],
            rawCanvasPoints: [],
            velocityPxPerS: 900,
            isSliceActive: true,
            canvasPoints: Array.from({ length: 24 }, (_, i) => ({
              x: 30 + i * 8,
              y: 200 + pointerId * 100 + Math.sin(i) * 12,
              tMs: 0,
            })),
          }))
        : [],
    },
  }
  const before = JSON.stringify(state)
  const renderer = createRenderer()
  const cpuMs: number[] = [],
    intervalsMs: number[] = []
  let previous = 0
  // Warm-up covers cache construction and JIT; samples use the native RAF clock.
  for (let i = 0; i < frames + 60; i++) {
    const timestampMs = await new Promise<number>((resolve) => requestAnimationFrame(resolve))
    for (const trail of context.debug.trails)
      for (const point of trail.canvasPoints) point.tMs = timestampMs
    const start = performance.now()
    renderer.render(
      ctx,
      state,
      { frame: i, timestampMs, deltaMs: timestampMs - previous, elapsedMs: timestampMs },
      context,
    )
    const cpu = performance.now() - start
    if (i >= 60) {
      cpuMs.push(cpu)
      intervalsMs.push(timestampMs - previous)
    }
    previous = timestampMs
  }
  return { cpuMs, intervalsMs, unchanged: before === JSON.stringify(state), frames }
}
