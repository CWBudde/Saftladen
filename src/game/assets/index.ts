import { IMAGE_ASSET_MANIFEST } from './manifest'
import { createImageAssetLoader } from './preload'

export const gameAssets = createImageAssetLoader(IMAGE_ASSET_MANIFEST)
export { IMAGE_ASSET_MANIFEST, type ImageAssetEntry, type ImageAssetKey } from './manifest'
export { createImageAssetLoader, type AssetReadiness } from './preload'
