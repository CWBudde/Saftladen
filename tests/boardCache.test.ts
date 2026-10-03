import { expect, test } from 'bun:test'
import { createBoardCache } from '../src/game/render/boardCache'

test('board cache invalidates on geometry, DPR, dojo and decoded artwork changes, retaining one surface', () => {
  let surfaces = 0, paints = 0, blits = 0
  const transforms: number[][] = []
  const target = { setTransform: (...args: number[]) => transforms.push(args) } as unknown as CanvasRenderingContext2D
  const surface = { width: 0, height: 0, getContext: () => target } as unknown as HTMLCanvasElement
  const cache = createBoardCache(() => { surfaces++; return surface })
  const ctx = { clearRect() {}, drawImage: () => { blits++ } } as unknown as CanvasRenderingContext2D
  const metrics = { widthCssPx: 390, heightCssPx: 844, widthDevicePx: 390, heightDevicePx: 844, dpr: 1 }
  const paint = (context: CanvasRenderingContext2D) => { expect(context).toBe(target); paints++ }
  cache.draw(ctx, metrics, 'great-wave', null, paint)
  cache.draw(ctx, { ...metrics }, 'great-wave', null, paint)
  expect(paints).toBe(1)
  metrics.dpr = 3; metrics.widthDevicePx *= 3; metrics.heightDevicePx *= 3
  cache.draw(ctx, metrics, 'great-wave', null, paint)
  expect(paints).toBe(2)
  expect(transforms.at(-1)).toEqual([3, 0, 0, 3, 0, 0])
  expect(surface.width).toBe(1170)
  const image = {} as HTMLImageElement
  cache.draw(ctx, metrics, 'great-wave', image, paint)
  cache.draw(ctx, metrics, 'great-wave', image, paint)
  expect(paints).toBe(3)
  cache.draw(ctx, metrics, 'sunset-harbor', image, paint)
  cache.draw(ctx, { ...metrics, widthCssPx: 844, heightCssPx: 390, widthDevicePx: 2532, heightDevicePx: 1170 }, 'sunset-harbor', image, paint)
  expect(paints).toBe(5)
  expect(surface.height).toBe(1170)
  expect(surfaces).toBe(1)
  expect(blits).toBe(7)
})

test('unavailable offscreen contexts keep the direct drawing fallback usable', () => {
  for (const createSurface of [() => undefined, () => ({ getContext: () => null }) as unknown as HTMLCanvasElement]) {
    const cache = createBoardCache(createSurface)
    const ctx = {} as CanvasRenderingContext2D
    let paints = 0
    const metrics = { widthCssPx: 390, heightCssPx: 844, widthDevicePx: 390, heightDevicePx: 844, dpr: 1 }
    for (let i = 0; i < 2; i++) cache.draw(ctx, metrics, 'storm-temple', null, target => { expect(target).toBe(ctx); paints++ })
    expect(paints).toBe(2)
  }
})
