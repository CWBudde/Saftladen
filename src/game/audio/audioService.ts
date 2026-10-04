import { Howl, Howler } from 'howler'
import musicTrack from '../../assets/music.mp3'
import { createSoundObjectUrl } from './tone'
import { SOUND_RECIPES, createSoundVariationSelector } from './soundDesign'
import { sfxGain, type AudioSfxName } from './sfxMix'
import { createVoicePool } from './voicePool'

export type { AudioSfxName } from './sfxMix'

type AudioService = {
  initOnUserGesture: () => void
  /** Unlock audio context and SFX without starting music playback. */
  initMuted: () => void
  /** Attempt to autoplay music immediately (for PWA / installed app context). */
  tryAutoPlay: () => void
  playSfx: (name: AudioSfxName, rate?: number) => void
  setMusicVolume: (volume: number) => void
  setSfxVolume: (volume: number) => void
  getMusicVolume: () => number
  getSfxVolume: () => number
  stopAll: () => void
  toggleMusic: () => boolean
  isMusicPlaying: () => boolean
}

type SfxPack = Record<AudioSfxName, Howl[]>

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function createSfxPack(sfxVolume: number): { pack: SfxPack; urls: string[] } {
  const urls: string[] = []
  const pack = {} as SfxPack
  for (const name of Object.keys(SOUND_RECIPES) as AudioSfxName[]) {
    pack[name] = SOUND_RECIPES[name].map((recipe) => {
      const url = createSoundObjectUrl(recipe)
      urls.push(url)
      return new Howl({ src: [url], format: ['wav'], volume: sfxGain(name, sfxVolume) })
    })
  }
  return { urls, pack }
}

export function createAudioService(
  initialMusicVolume = 0.26,
  initialSfxVolume = 0.42,
): AudioService {
  let unlocked = false
  let musicVolume = clamp01(initialMusicVolume)
  let sfxVolume = clamp01(initialSfxVolume)
  let sfxObjectUrls: string[] = []
  let sfxPack: SfxPack | null = null
  const voices = createVoicePool(8)
  const variations = createSoundVariationSelector()
  let duckTimer: ReturnType<typeof setTimeout> | undefined

  const music = new Howl({
    src: [musicTrack],
    html5: true,
    loop: true,
    volume: musicVolume,
    preload: false,
  })

  const ensureSfxReady = () => {
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
  }

  const ensureUnlocked = () => {
    if (unlocked) {
      return
    }

    unlocked = true
    ensureSfxReady()

    if (!music.playing()) {
      music.play()
    }
  }

  /** Unlock audio context and SFX but do NOT start music. */
  const initMuted = () => {
    if (unlocked) {
      return
    }

    unlocked = true
    ensureSfxReady()
  }

  /** Try to autoplay music immediately (PWA context). */
  const tryAutoPlay = () => {
    unlocked = true
    ensureSfxReady()

    if (!music.playing()) {
      music.play()
    }
  }

  const playSfx = (name: AudioSfxName, rate = 1) => {
    if (!unlocked || !sfxPack || sfxVolume === 0) {
      return
    }

    const howl = sfxPack[name][variations.next(name)]
    voices.prepare()
    const id = howl.play()
    // A Howl waiting for decode already owns a slot for its queued playback.
    voices.add({
      playing: () => howl.state() !== 'loaded' || howl.playing(id),
      stop: () => howl.stop(id),
    })
    // Explicitly reset per-play rate: reused Howler sound IDs retain prior rates.
    howl.rate(Number.isFinite(rate) ? Math.max(0.8, Math.min(1.4, rate)) : 1, id)
    if (name === 'bomb' || name === 'game-over') {
      clearTimeout(duckTimer)
      music.volume(musicVolume * 0.35)
      duckTimer = setTimeout(() => {
        duckTimer = undefined
        music.volume(musicVolume)
      }, 650)
    }
  }

  const setMusicVolume = (volume: number) => {
    musicVolume = clamp01(volume)
    music.volume(musicVolume * (duckTimer === undefined ? 1 : 0.35))
  }

  const setSfxVolume = (volume: number) => {
    sfxVolume = clamp01(volume)
    if (!sfxPack) {
      return
    }
    for (const name of Object.keys(sfxPack) as AudioSfxName[]) {
      sfxPack[name].forEach((howl) => howl.volume(sfxGain(name, sfxVolume)))
    }
  }

  const stopAll = () => {
    clearTimeout(duckTimer)
    duckTimer = undefined
    voices.clear()
    variations.reset()
    music.stop()
    music.volume(musicVolume)
    unlocked = false
    if (sfxPack) {
      Object.values(sfxPack)
        .flat()
        .forEach((howl) => howl.unload())
    }
    sfxPack = null
    sfxObjectUrls.forEach((url) => URL.revokeObjectURL(url))
    sfxObjectUrls = []
  }

  const toggleMusic = (): boolean => {
    initMuted()
    if (music.playing()) {
      music.pause()
      return false
    } else {
      music.play()
      return true
    }
  }

  const isMusicPlaying = (): boolean => {
    return music.playing()
  }

  return {
    initOnUserGesture: ensureUnlocked,
    initMuted,
    tryAutoPlay,
    playSfx,
    setMusicVolume,
    setSfxVolume,
    getMusicVolume: () => musicVolume,
    getSfxVolume: () => sfxVolume,
    stopAll,
    toggleMusic,
    isMusicPlaying,
  }
}

export type { AudioService }
