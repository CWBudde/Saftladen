export type AssetReadiness = {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'fallback'
  loaded: number
  total: number
  failed: readonly string[]
}

type ImageEntry<Key extends string> = { key: Key; src: string }
type LoaderOptions = { createImage?: () => HTMLImageElement; timeoutMs?: number }

// A loader outlives React mounts, shares decoded images with the renderer,
// deduplicates concurrent requests, and keeps successes when retrying failures.
export function createImageAssetLoader<Key extends string>(
  entries: readonly ImageEntry<Key>[],
  { createImage = () => new Image(), timeoutMs = 20_000 }: LoaderOptions = {},
) {
  const images = new Map<Key, HTMLImageElement>()
  const listeners = new Set<() => void>()
  let snapshot: AssetReadiness = { status: 'idle', loaded: 0, total: entries.length, failed: [] }
  let pending: Promise<void> | null = null

  const publish = (status: AssetReadiness['status'], failed: readonly string[] = []) => {
    snapshot = { status, loaded: images.size, total: entries.length, failed }
    listeners.forEach((listener) => listener())
  }

  const loadOne = (entry: ImageEntry<Key>) => new Promise<void>((resolve, reject) => {
    let image: HTMLImageElement
    try { image = createImage() } catch (error) { reject(error); return }
    let settled = false
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      if (error) reject(error)
      else {
        images.set(entry.key, image)
        publish('loading')
        resolve()
      }
    }
    const timeout = setTimeout(() => finish(new Error('Image loading timed out')), timeoutMs)
    image.decoding = 'async'
    image.onload = () => {
      // onload alone does not guarantee the first draw can use the image.
      Promise.resolve().then(() => image.decode?.()).then(() => {
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error('Empty image')
        finish()
      }).catch(finish)
    }
    image.onerror = () => finish(new Error('Image request failed'))
    try { image.src = entry.src } catch (error) { finish(error) }
  })

  return {
    getSnapshot: () => snapshot,
    getImage: (key: Key) => images.get(key) ?? null,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    load: () => {
      if (pending) return pending
      if (snapshot.status === 'ready') return Promise.resolve()
      publish('loading')
      const missing = entries.filter((entry) => !images.has(entry.key))
      pending = Promise.allSettled(missing.map(loadOne)).then((results) => {
        const failed = missing.filter((_, index) => results[index].status === 'rejected').map((entry) => entry.key)
        publish(failed.length > 0 ? 'error' : 'ready', failed)
      }).finally(() => { pending = null })
      return pending
    },
    allowFallback: () => {
      if (snapshot.status === 'error') publish('fallback', snapshot.failed)
    },
  }
}
