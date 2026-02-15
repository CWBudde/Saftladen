export type ImageAssetKey =
  | 'fruitAtlas'
  | 'bombSprite'
  | 'powerUpAtlas'
  | 'backgroundTexture'
  | 'uiHud'

export type AudioAssetKey =
  | 'sliceSfx'
  | 'bombSfx'
  | 'missSfx'
  | 'gameOverSfx'
  | 'musicLoop'

export type ImageAssetEntry = {
  key: ImageAssetKey
  src: string
}

export type AudioAssetEntry = {
  key: AudioAssetKey
  src: string
}

export const IMAGE_ASSET_MANIFEST: ImageAssetEntry[] = [
  { key: 'fruitAtlas', src: '/assets/images/fruit-atlas.png' },
  { key: 'bombSprite', src: '/assets/images/bomb.png' },
  { key: 'powerUpAtlas', src: '/assets/images/powerups.png' },
  { key: 'backgroundTexture', src: '/assets/images/background.jpg' },
  { key: 'uiHud', src: '/assets/images/hud.png' },
]

export const AUDIO_ASSET_MANIFEST: AudioAssetEntry[] = [
  { key: 'sliceSfx', src: '/assets/audio/slice.wav' },
  { key: 'bombSfx', src: '/assets/audio/bomb.wav' },
  { key: 'missSfx', src: '/assets/audio/miss.wav' },
  { key: 'gameOverSfx', src: '/assets/audio/game-over.wav' },
  { key: 'musicLoop', src: '/assets/audio/music-loop.mp3' },
]
