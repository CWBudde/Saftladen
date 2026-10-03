import { expect, test } from 'bun:test'
import { SOUND_RECIPES, comboPlaybackRate, createSoundVariationSelector } from '../src/game/audio/soundDesign'
import { encodeWavPcm16, SFX_SAMPLE_RATE, synthesizeSound } from '../src/game/audio/tone'
import { eventSounds } from '../src/game/ui/eventFeedback'
import type { GamePresentationEvent } from '../src/game/types'

test('all baked effects have headroom, non-silent bodies and click-free edges', () => {
  for (const recipes of Object.values(SOUND_RECIPES)) {
    for (const recipe of recipes) {
      const pcm = synthesizeSound(recipe)
      let peak = 0
      let energy = 0
      for (const sample of pcm) {
        peak = Math.max(peak, Math.abs(sample))
        energy += sample * sample
      }
      expect(peak).toBeLessThanOrEqual(Math.ceil(0.88 * 32_767))
      expect(Math.sqrt(energy / pcm.length) / 32_767).toBeGreaterThan(0.01)
      expect(pcm[0]).toBe(0)
      expect(pcm[pcm.length - 1]).toBe(0)
      expect(pcm.length / SFX_SAMPLE_RATE).toBeLessThanOrEqual(0.62)
      expect(synthesizeSound(recipe)).toEqual(pcm)
    }
  }
})

test('WAV samples and header describe the same mono PCM payload', () => {
  const pcm = synthesizeSound(SOUND_RECIPES.slice[0])
  const wav = encodeWavPcm16(pcm)
  const view = new DataView(wav)
  const tag = (offset: number) => String.fromCharCode(...new Uint8Array(wav, offset, 4))
  expect(tag(0)).toBe('RIFF')
  expect(tag(8)).toBe('WAVE')
  expect(tag(36)).toBe('data')
  expect(view.getUint32(4, true)).toBe(wav.byteLength - 8)
  expect(view.getUint16(20, true)).toBe(1)
  expect(view.getUint16(22, true)).toBe(1)
  expect(view.getUint32(24, true)).toBe(SFX_SAMPLE_RATE)
  expect(view.getUint32(28, true)).toBe(SFX_SAMPLE_RATE * 2)
  expect(view.getUint16(32, true)).toBe(2)
  expect(view.getUint16(34, true)).toBe(16)
  expect(view.getUint32(40, true)).toBe(pcm.byteLength)
  expect(new Int16Array(wav.slice(44))).toEqual(pcm)
})

test('cut/bomb variations are distinct, bounded and independent across effects and resets', () => {
  const selector = createSoundVariationSelector()
  expect(selector.next('slice')).toBe(0)
  expect(selector.next('bomb')).toBe(0)
  expect(selector.next('slice')).toBe(1)
  expect(selector.next('slice')).toBe(2)
  expect(selector.next('slice')).toBe(0)
  expect(selector.next('bomb')).toBe(1)
  expect(selector.next('bomb')).toBe(0)
  selector.reset()
  expect(selector.next('slice')).toBe(0)
  for (const name of ['slice', 'bomb'] as const) {
    const waves = SOUND_RECIPES[name].map(synthesizeSound)
    for (let i = 1; i < waves.length; i++) expect(waves[i]).not.toEqual(waves[i - 1])
  }
  expect(synthesizeSound(SOUND_RECIPES['power-up'][0])).not.toEqual(synthesizeSound(SOUND_RECIPES['power-up-expired'][0]))
})

test('growing gesture cues rise within a capped range, with no extra sounds for timed streaks', () => {
  const events: GamePresentationEvent[] = [
    { id: 1, runId: 'run', type: 'fruit-slice', atMs: 100, entityId: 'entity_1',
      fruitType: 'apple', position: { x: 10, y: 20 }, direction: { x: 1, y: 0 }, points: 10, combo: 10 },
    ...[3, 4, 5, 8, 100].map((fruitCount, index): GamePresentationEvent => ({
      id: index + 2, runId: 'run', type: 'stroke-combo', atMs: 100, strokeId: 1,
      fruitCount, bonus: 15, position: { x: 10, y: 20 },
    })),
  ]
  const before = JSON.stringify(events)
  const cues = eventSounds(events)
  expect(cues[0]).toEqual({ name: 'slice' })
  expect(cues.slice(1).every(cue => cue.name === 'combo')).toBe(true)
  expect(cues[1].rate).toBe(1)
  expect(cues[2].rate).toBeGreaterThan(cues[1].rate!)
  expect(cues[3].rate).toBeGreaterThan(cues[2].rate!)
  expect(cues[4].rate).toBe(cues[5].rate)
  expect(cues[5].rate).toBeLessThan(1.3)
  expect(comboPlaybackRate(NaN)).toBe(1)
  expect(comboPlaybackRate(-1)).toBe(1)
  expect(JSON.stringify(events)).toBe(before)
})
