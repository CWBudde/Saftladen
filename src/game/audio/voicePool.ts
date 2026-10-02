type Voice = { playing: () => boolean; stop: () => void }

/** Bound active effects across all sounds, dropping the oldest voice first. */
export function createVoicePool(limit = 8) {
  let voices: Voice[] = []
  return {
    prepare() {
      voices = voices.filter((voice) => voice.playing())
      while (voices.length >= limit) voices.shift()?.stop()
    },
    add(voice: Voice) { voices.push(voice) },
    clear() {
      voices.forEach((voice) => voice.stop())
      voices.length = 0
    },
  }
}
