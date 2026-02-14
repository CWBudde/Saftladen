import { IMAGE_ASSET_MANIFEST, type ImageAssetEntry, type ImageAssetKey } from './manifest'

export type DecodedImageAsset = {
  entry: ImageAssetEntry
  image: HTMLImageElement
  bitmap?: ImageBitmap
}

export type ImageAssetMap = Record<ImageAssetKey, DecodedImageAsset>

type PreloadOptions = {
  preferImageBitmap?: boolean
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    image.src = src
  })
}

async function decodeWithBitmap(image: HTMLImageElement): Promise<ImageBitmap | undefined> {
  if (typeof createImageBitmap !== 'function') {
    return undefined
  }

  try {
    return await createImageBitmap(image)
  } catch {
    return undefined
  }
}

export async function preloadImageAssets(options: PreloadOptions = {}): Promise<ImageAssetMap> {
  const preferImageBitmap = options.preferImageBitmap ?? true
  const decodedEntries = await Promise.all(
    IMAGE_ASSET_MANIFEST.map(async (entry) => {
      const image = await loadImageElement(entry.src)
      const bitmap = preferImageBitmap ? await decodeWithBitmap(image) : undefined
      return {
        key: entry.key,
        value: {
          entry,
          image,
          bitmap,
        },
      }
    }),
  )

  const assets = {} as ImageAssetMap
  decodedEntries.forEach(({ key, value }) => {
    assets[key] = value
  })
  return assets
}
