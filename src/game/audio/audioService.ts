import { Howl, Howler } from 'howler'
import musicTrack from '../../assets/music.mp3'
import { createToneObjectUrl } from './tone'
import { sfxGain, type AudioSfxName } from './sfxMix'
import { createVoicePool } from './voicePool'

export type { AudioSfxName } from './sfxMix'

type AudioService = {
  initOnUserGesture: () => void
  /** Unlock audio context and SFX without starting music playback. */
  initMuted: () => void
  /** Attempt to autoplay music immediately (for PWA / installed app context). */
  tryAutoPlay: () => void
  playSfx: (name: AudioSfxName) => void
  setMusicVolume: (volume: number) => void
  setSfxVolume: (volume: number) => void
  getMusicVolume: () => number
  getSfxVolume: () => number
  stopAll: () => void
  toggleMusic: () => boolean
  isMusicPlaying: () => boolean
}

type SfxPack = Record<AudioSfxName, Howl>

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function createSfxPack(sfxVolume: number): { pack: SfxPack; urls: string[] } {
  const urls = [
    createToneObjectUrl({ frequencyHz: 1250, endFrequencyHz: 340, durationMs: 105, volume: 0.55, shape: 'triangle', noiseMix: 0.55 }),
    createToneObjectUrl({ frequencyHz: 320, durationMs: 140, volume: 0.5, shape: 'sine' }),
    createToneObjectUrl({ frequencyHz: 130, endFrequencyHz: 35, durationMs: 290, volume: 0.58, shape: 'triangle', noiseMix: 0.68 }),
    createToneObjectUrl({ frequencyHz: 440, endFrequencyHz: 110, durationMs: 620, volume: 0.65, shape: 'triangle' }),
    createToneObjectUrl({ frequencyHz: 980, durationMs: 160, volume: 0.5, shape: 'sine' }),
    createToneObjectUrl({ frequencyHz: 660, durationMs: 60, volume: 0.35, shape: 'sine' }),
    createToneObjectUrl({ frequencyHz: 720, endFrequencyHz: 320, durationMs: 180, volume: 0.4, shape: 'sine' }),
    createToneObjectUrl({ frequencyHz: 680, endFrequencyHz: 1420, durationMs: 180, volume: 0.45, shape: 'triangle' }),
  ]

  return {
    urls,
    pack: {
      slice: new Howl({ src: [urls[0]], format: ['wav'], volume: sfxGain('slice', sfxVolume) }),
      miss: new Howl({ src: [urls[1]], format: ['wav'], volume: sfxGain('miss', sfxVolume) }),
      bomb: new Howl({ src: [urls[2]], format: ['wav'], volume: sfxGain('bomb', sfxVolume) }),
      'game-over': new Howl({ src: [urls[3]], format: ['wav'], volume: sfxGain('game-over', sfxVolume) }),
      'power-up': new Howl({ src: [urls[4]], format: ['wav'], volume: sfxGain('power-up', sfxVolume) }),
      'ui-click': new Howl({ src: [urls[5]], format: ['wav'], volume: sfxGain('ui-click', sfxVolume) }),
      'power-up-expired': new Howl({ src: [urls[6]], format: ['wav'], volume: sfxGain('power-up-expired', sfxVolume) }),
      combo: new Howl({ src: [urls[7]], format: ['wav'], volume: sfxGain('combo', sfxVolume) }),
    },
  }
}

export function createAudioService(initialMusicVolume = 0.26, initialSfxVolume = 0.42): AudioService {
  let unlocked = false
  let musicVolume = clamp01(initialMusicVolume)
  let sfxVolume = clamp01(initialSfxVolume)
  let sfxObjectUrls: string[] = []
  let sfxPack: SfxPack | null = null
  const voices = createVoicePool(8)
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

  const playSfx = (name: AudioSfxName) => {
    if (!unlocked || !sfxPack || sfxVolume === 0) {
      return
    }

    const howl = sfxPack[name]
    voices.prepare()
    const id = howl.play()
    // A Howl waiting for decode already owns a slot for its queued playback.
    voices.add({ playing: () => howl.state() !== 'loaded' || howl.playing(id), stop: () => howl.stop(id) })
    if (name === 'slice') {
      const jitter = 0.92 + Math.random() * 0.18
      howl.rate(jitter, id)
    }
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
      sfxPack[name].volume(sfxGain(name, sfxVolume))
    }
  }

  const stopAll = () => {
    clearTimeout(duckTimer)
    duckTimer = undefined
    voices.clear()
    music.stop()
    music.volume(musicVolume)
    unlocked = false
    if (sfxPack) {
      Object.values(sfxPack).forEach((howl) => howl.unload())
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
