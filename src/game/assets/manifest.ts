import background from '../../assets/background.jpg'
import appleWhole from '../../assets/apple1.png'
import appleCut from '../../assets/apple3.png'
import orangeWhole from '../../assets/orange1.png'
import orangeLeft from '../../assets/orange3.png'
import orangeRight from '../../assets/orange4.png'
import watermelonWhole from '../../assets/melon1.png'
import watermelonCut from '../../assets/melon3.png'
import pineappleWhole from '../../assets/pineapple1.png'
import pineappleRight from '../../assets/pineapple4.png'
import pineappleLeft from '../../assets/pineapple5.png'
import bananaWhole from '../../assets/banana1.png'
import bananaCut from '../../assets/banana3.png'
import starfruitWhole from '../../assets/starfruit1.png'
import starfruitLeft from '../../assets/starfruit4.png'
import starfruitRight from '../../assets/starfruit5.png'
import bomb from '../../assets/bomb.png'
import freeze from '../../assets/freeze-glyph.png'
import title from '../../assets/title.png'

const IMAGE_URLS = {
  background, appleWhole, appleCut, orangeWhole, orangeLeft, orangeRight,
  watermelonWhole, watermelonCut, pineappleWhole, pineappleLeft, pineappleRight,
  bananaWhole, bananaCut, starfruitWhole, starfruitLeft, starfruitRight, bomb, freeze, title,
}

export type ImageAssetKey = keyof typeof IMAGE_URLS
export type ImageAssetEntry = { key: ImageAssetKey; src: string }

// Vite resolves imports relative to the deployment base and fingerprints images.
// These are the exact sprites consumed by the menu and renderer.
export const IMAGE_ASSET_MANIFEST: readonly ImageAssetEntry[] = Object.entries(IMAGE_URLS)
  .map(([key, src]) => ({ key: key as ImageAssetKey, src }))
