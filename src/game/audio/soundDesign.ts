import type { AudioSfxName } from './sfxMix'
import type { SoundRecipe } from './tone'

// Each recipe is premixed into one WAV: layering cannot multiply the voice budget.
export const SOUND_RECIPES: Record<AudioSfxName, readonly SoundRecipe[]> = {
  slice: [0, 1, 2].map(variation => ({ layers: [
    // Bright blade sweep, a short cut body, then softer droplets.
    { durationMs: 65 + variation * 7, frequencyHz: 1800, endFrequencyHz: 480, gain: 0.42, noiseMix: 0.9, seed: 101 + variation },
    { startMs: 8, durationMs: 55, frequencyHz: 420 + variation * 55, endFrequencyHz: 120, gain: 0.32, shape: 'triangle', decay: 2 },
    { startMs: 27, durationMs: 100 + variation * 9, frequencyHz: 240, endFrequencyHz: 95, gain: 0.5, noiseMix: 0.95, noiseColor: 'warm', seed: 701 + variation },
    { startMs: 50 + variation * 5, durationMs: 42, frequencyHz: 920 + variation * 90, endFrequencyHz: 280, gain: 0.09, decay: 2 },
  ] })),
  bomb: [0, 1].map(variation => ({ layers: [
    { durationMs: 65, frequencyHz: 800, endFrequencyHz: 100, gain: 0.7, noiseMix: 0.92, seed: 400 + variation },
    { startMs: 4, durationMs: 310, frequencyHz: 115 + variation * 12, endFrequencyHz: 32, gain: 0.65, decay: 2 },
    { startMs: 20, durationMs: 440, frequencyHz: 100, endFrequencyHz: 40, gain: 0.6, noiseMix: 1, noiseColor: 'warm', seed: 900 + variation },
  ] })),
  combo: [{ layers: [
    { durationMs: 190, frequencyHz: 660, endFrequencyHz: 880, gain: 0.3 },
    { startMs: 24, durationMs: 200, frequencyHz: 990, endFrequencyHz: 1320, gain: 0.22 },
    { startMs: 48, durationMs: 200, frequencyHz: 1320, endFrequencyHz: 1760, gain: 0.16 },
    { durationMs: 60, frequencyHz: 1800, gain: 0.1, noiseMix: 0.85 },
  ] }],
  'power-up': [{ layers: [
    { durationMs: 140, frequencyHz: 523.25, gain: 0.3 },
    { startMs: 55, durationMs: 150, frequencyHz: 659.25, gain: 0.28 },
    { startMs: 110, durationMs: 210, frequencyHz: 783.99, gain: 0.25 },
    { startMs: 165, durationMs: 190, frequencyHz: 1046.5, gain: 0.13 },
  ] }],
  'power-up-expired': [{ layers: [
    { durationMs: 130, frequencyHz: 659.25, gain: 0.26 },
    { startMs: 65, durationMs: 180, frequencyHz: 392, endFrequencyHz: 330, gain: 0.2 },
  ] }],
  miss: [{ layers: [
    { durationMs: 140, frequencyHz: 330, endFrequencyHz: 200, gain: 0.35 },
    { startMs: 12, durationMs: 130, frequencyHz: 165, endFrequencyHz: 100, gain: 0.15 },
  ] }],
  'game-over': [{ layers: [
    { durationMs: 260, frequencyHz: 440, endFrequencyHz: 330, gain: 0.32 },
    { startMs: 140, durationMs: 290, frequencyHz: 330, endFrequencyHz: 220, gain: 0.3 },
    { startMs: 300, durationMs: 320, frequencyHz: 220, endFrequencyHz: 110, gain: 0.3 },
  ] }],
  'ui-click': [{ layers: [{ durationMs: 45, frequencyHz: 740, endFrequencyHz: 560, gain: 0.25, decay: 2 }] }],
}

export type AudioCue = { name: AudioSfxName; rate?: number }

/** A rising major-third range punctuates larger gestures without louder peaks. */
export function comboPlaybackRate(fruitCount: number): number {
  const count = Number.isFinite(fruitCount) ? fruitCount : 3
  return 2 ** (Math.max(0, Math.min(4, count - 3)) / 12)
}

/** Round-robin variation is audio-local; pause/replay and FX never use engine RNG. */
export function createSoundVariationSelector() {
  const cursors = new Map<AudioSfxName, number>()
  return {
    next(name: AudioSfxName): number {
      const index = cursors.get(name) ?? 0
      cursors.set(name, (index + 1) % SOUND_RECIPES[name].length)
      return index
    },
    reset() { cursors.clear() },
  }
}
