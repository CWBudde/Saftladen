import { Howl, Howler } from 'howler'
import musicTrack from '../../assets/music.mp3'
import { createToneObjectUrl } from './tone'

export type AudioSfxName = 'slice' | 'miss' | 'bomb' | 'game-over' | 'power-up' | 'ui-click'

type AudioService = {
  initOnUserGesture: () => void
  playSfx: (name: AudioSfxName) => void
  setMusicVolume: (volume: number) => void
  setSfxVolume: (volume: number) => void
  stopAll: () => void
}

type SfxPack = Record<AudioSfxName, Howl>

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function createSfxPack(sfxVolume: number): { pack: SfxPack; urls: string[] } {
  const urls = [
    createToneObjectUrl({ frequencyHz: 760, durationMs: 90, volume: 0.55, shape: 'triangle' }),
    createToneObjectUrl({ frequencyHz: 320, durationMs: 140, volume: 0.5, shape: 'sine' }),
    createToneObjectUrl({ frequencyHz: 130, durationMs: 210, volume: 0.58, shape: 'square' }),
    createToneObjectUrl({ frequencyHz: 180, durationMs: 420, volume: 0.45, shape: 'triangle' }),
    createToneObjectUrl({ frequencyHz: 980, durationMs: 160, volume: 0.5, shape: 'sine' }),
    createToneObjectUrl({ frequencyHz: 660, durationMs: 60, volume: 0.35, shape: 'sine' }),
  ]

  return {
    urls,
    pack: {
      slice: new Howl({ src: [urls[0]], format: ['wav'], volume: sfxVolume }),
      miss: new Howl({ src: [urls[1]], format: ['wav'], volume: sfxVolume }),
      bomb: new Howl({ src: [urls[2]], format: ['wav'], volume: Math.min(1, sfxVolume + 0.05) }),
      'game-over': new Howl({ src: [urls[3]], format: ['wav'], volume: sfxVolume }),
      'power-up': new Howl({ src: [urls[4]], format: ['wav'], volume: sfxVolume }),
      'ui-click': new Howl({ src: [urls[5]], format: ['wav'], volume: Math.max(0.2, sfxVolume * 0.7) }),
    },
  }
}

export function createAudioService(initialMusicVolume = 0.26, initialSfxVolume = 0.42): AudioService {
  let unlocked = false
  let musicVolume = clamp01(initialMusicVolume)
  let sfxVolume = clamp01(initialSfxVolume)
  let sfxObjectUrls: string[] = []
  let sfxPack: SfxPack | null = null

  const music = new Howl({
    src: [musicTrack],
    html5: true,
    loop: true,
    volume: musicVolume,
    preload: true,
  })

  const ensureUnlocked = () => {
    if (unlocked) {
      return
    }

    unlocked = true
    Howler.autoUnlock = true

    if (!sfxPack) {
      const created = createSfxPack(sfxVolume)
      sfxPack = created.pack
      sfxObjectUrls = created.urls
    }

    const ctx = Howler.ctx
    if (ctx && typeof ctx.resume === 'function' && ctx.state === 'suspended') {
      void ctx.resume()
    }

    if (!music.playing()) {
      music.play()
    }
  }

  const playSfx = (name: AudioSfxName) => {
    if (!unlocked || !sfxPack) {
      return
    }

    const howl = sfxPack[name]
    const id = howl.play()
    if (name === 'slice') {
      const jitter = 0.92 + Math.random() * 0.18
      howl.rate(jitter, id)
    }
  }

  const setMusicVolume = (volume: number) => {
    musicVolume = clamp01(volume)
    music.volume(musicVolume)
  }

  const setSfxVolume = (volume: number) => {
    sfxVolume = clamp01(volume)
    if (!sfxPack) {
      return
    }
    Object.values(sfxPack).forEach((howl) => howl.volume(sfxVolume))
  }

  const stopAll = () => {
    music.stop()
    if (sfxPack) {
      Object.values(sfxPack).forEach((howl) => howl.unload())
    }
    sfxPack = null
    sfxObjectUrls.forEach((url) => URL.revokeObjectURL(url))
    sfxObjectUrls = []
  }

  return {
    initOnUserGesture: ensureUnlocked,
    playSfx,
    setMusicVolume,
    setSfxVolume,
    stopAll,
  }
}

export type { AudioService }
