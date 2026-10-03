import { expect, test } from 'bun:test'
import { createImageAssetLoader } from '../src/game/assets/preload'

function fakeImage(decode: (() => Promise<void>) | undefined = () => Promise.resolve()) {
  return {
    src: '', decoding: '', naturalWidth: 64, naturalHeight: 64,
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    decode,
  }
}

const entries = [{ key: 'fruit', src: '/fruit.png' }, { key: 'bomb', src: '/bomb.png' }] as const
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve))

test('readiness waits for decoding and remount loads share one request and image', async () => {
  let finishDecode!: () => void
  const image = fakeImage(() => new Promise<void>((resolve) => { finishDecode = resolve }))
  let requests = 0
  const loader = createImageAssetLoader(entries.slice(0, 1), {
    createImage: () => { requests++; return image as unknown as HTMLImageElement },
  })
  const first = loader.load()
  const remount = loader.load()
  expect(remount).toBe(first)
  expect(requests).toBe(1)
  image.onload?.()
  await flush()
  expect(loader.getSnapshot().status).toBe('loading')
  expect(loader.getImage('fruit')).toBeNull()
  finishDecode()
  await first
  expect(loader.getSnapshot()).toEqual({ status: 'ready', loaded: 1, total: 1, failed: [] })
  expect(loader.getImage('fruit')).toBe(image as unknown as HTMLImageElement)
  await loader.load()
  expect(requests).toBe(1)
})

test('retry requests failures only and preserves successful decoded images', async () => {
  const images: ReturnType<typeof fakeImage>[] = []
  const loader = createImageAssetLoader(entries, {
    createImage: () => {
      const image = fakeImage()
      images.push(image)
      return image as unknown as HTMLImageElement
    },
  })
  const first = loader.load()
  images[0].onload?.()
  images[1].onerror?.()
  await first
  expect(loader.getSnapshot()).toEqual({ status: 'error', loaded: 1, total: 2, failed: ['bomb'] })
  const retry = loader.load()
  expect(images.length).toBe(3)
  expect(images[2].src).toBe('/bomb.png')
  images[2].onload?.()
  await retry
  expect(loader.getSnapshot().status).toBe('ready')
  expect(loader.getImage('fruit')).toBe(images[0] as unknown as HTMLImageElement)
  expect(loader.getImage('bomb')).toBe(images[2] as unknown as HTMLImageElement)
})

test('procedural artwork requires an explicit choice after a failed load', async () => {
  const image = fakeImage()
  const loader = createImageAssetLoader(entries.slice(0, 1), { createImage: () => image as unknown as HTMLImageElement })
  const loading = loader.load()
  loader.allowFallback()
  expect(loader.getSnapshot().status).toBe('loading')
  image.onerror?.()
  await loading
  expect(loader.getSnapshot().status).toBe('error')
  loader.allowFallback()
  expect(loader.getSnapshot().status).toBe('fallback')
  expect(loader.getSnapshot().failed).toEqual(['fruit'])
  expect(loader.getImage('fruit')).toBeNull()
})

test('decode rejection and empty image dimensions are failures', async () => {
  const images = [fakeImage(() => Promise.reject(new Error('corrupt image'))), fakeImage()]
  images[1].naturalWidth = 0
  let index = 0
  const loader = createImageAssetLoader(entries, { createImage: () => images[index++] as unknown as HTMLImageElement })
  const loading = loader.load()
  images.forEach((image) => image.onload?.())
  await loading
  expect(loader.getSnapshot()).toEqual({ status: 'error', loaded: 0, total: 2, failed: ['fruit', 'bomb'] })
})

test('a stalled decode times out and late completion cannot silently clear the failure', async () => {
  let finishDecode!: () => void
  const image = fakeImage(() => new Promise<void>((resolve) => { finishDecode = resolve }))
  const loader = createImageAssetLoader(entries.slice(0, 1), {
    createImage: () => image as unknown as HTMLImageElement, timeoutMs: 10,
  })
  const loading = loader.load()
  image.onload?.()
  await loading
  expect(loader.getSnapshot().status).toBe('error')
  finishDecode()
  await flush()
  await flush()
  expect(loader.getImage('fruit')).toBeNull()
  expect(loader.getSnapshot().status).toBe('error')
  expect(image.onload).toBeNull()
  expect(image.onerror).toBeNull()
})

test('image construction failure settles and browsers without decode can become ready', async () => {
  const unavailable = createImageAssetLoader(entries, { createImage: () => { throw new Error('Unavailable') } })
  await unavailable.load()
  expect(unavailable.getSnapshot().status).toBe('error')
  const image = fakeImage()
  image.decode = undefined
  const loader = createImageAssetLoader(entries.slice(0, 1), { createImage: () => image as unknown as HTMLImageElement })
  const loading = loader.load()
  image.onload?.()
  await loading
  expect(loader.getSnapshot().status).toBe('ready')
})

test('readiness listeners receive stable snapshots and unsubscribe on unmount', async () => {
  const image = fakeImage()
  const loader = createImageAssetLoader(entries.slice(0, 1), { createImage: () => image as unknown as HTMLImageElement })
  expect(loader.getSnapshot()).toBe(loader.getSnapshot())
  let notifications = 0
  const unsubscribe = loader.subscribe(() => { notifications++ })
  const loading = loader.load()
  expect(notifications).toBe(1)
  unsubscribe()
  image.onload?.()
  await loading
  expect(notifications).toBe(1)
})
