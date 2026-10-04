import background from '../../assets/background.jpg'
import appleWhole from '../../assets/apple1.webp'
import appleCut from '../../assets/apple3.webp'
import orangeWhole from '../../assets/orange1.webp'
import orangeLeft from '../../assets/orange3.webp'
import orangeRight from '../../assets/orange4.webp'
import watermelonWhole from '../../assets/melon1.webp'
import watermelonCut from '../../assets/melon3.webp'
import pineappleWhole from '../../assets/pineapple1.webp'
import pineappleRight from '../../assets/pineapple4.webp'
import pineappleLeft from '../../assets/pineapple5.webp'
import bananaWhole from '../../assets/banana1.webp'
import bananaCut from '../../assets/banana3.webp'
import starfruitWhole from '../../assets/starfruit1.webp'
import starfruitLeft from '../../assets/starfruit4.webp'
import starfruitRight from '../../assets/starfruit5.webp'
import bomb from '../../assets/bomb.webp'
import freeze from '../../assets/freeze-glyph.webp'

const IMAGE_URLS = {
  background,
  appleWhole,
  appleCut,
  orangeWhole,
  orangeLeft,
  orangeRight,
  watermelonWhole,
  watermelonCut,
  pineappleWhole,
  pineappleLeft,
  pineappleRight,
  bananaWhole,
  bananaCut,
  starfruitWhole,
  starfruitLeft,
  starfruitRight,
  bomb,
  freeze,
}

export type ImageAssetKey = keyof typeof IMAGE_URLS
export type ImageAssetEntry = { key: ImageAssetKey; src: string }

// Vite resolves imports relative to the deployment base and fingerprints images.
// These are the exact sprites consumed by the menu and renderer.
export const IMAGE_ASSET_MANIFEST: readonly ImageAssetEntry[] = Object.entries(IMAGE_URLS).map(
  ([key, src]) => ({ key: key as ImageAssetKey, src }),
)
