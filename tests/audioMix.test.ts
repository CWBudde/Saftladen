import { describe, expect, test } from 'bun:test'
import { sfxGain, type AudioSfxName } from '../src/game/audio/sfxMix'

const effects: AudioSfxName[] = ['slice', 'miss', 'bomb', 'game-over', 'power-up', 'ui-click']

describe('SFX master volume', () => {
  test('mute silences every effect, including bombs, game over, and clicks', () => {
    for (const effect of effects) {
      expect(sfxGain(effect, 0)).toBe(0)
    }
  })

  test('changing the master preserves the effect mix', () => {
    for (const effect of effects) {
      expect(sfxGain(effect, 0.4)).toBeCloseTo(sfxGain(effect, 0.2) * 2)
    }
    expect(sfxGain('ui-click', 0.4)).toBeLessThan(sfxGain('slice', 0.4))
    expect(sfxGain('bomb', 0.4)).toBeGreaterThan(sfxGain('slice', 0.4))
  })

  test('invalid and out-of-range settings produce a bounded gain', () => {
    for (const effect of effects) {
      expect(sfxGain(effect, -1)).toBe(0)
      expect(sfxGain(effect, Number.NaN)).toBe(0)
      expect(sfxGain(effect, 2)).toBeLessThanOrEqual(1)
    }
  })
})
