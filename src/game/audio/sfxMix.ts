export type AudioSfxName = 'slice' | 'miss' | 'bomb' | 'game-over' | 'power-up' | 'power-up-expired' | 'combo' | 'ui-click'

const SFX_GAINS: Record<AudioSfxName, number> = {
  slice: 1,
  miss: 0.8,
  bomb: 1.12,
  'game-over': 1.16,
  'power-up': 1,
  'power-up-expired': 0.65,
  combo: 0.85,
  'ui-click': 0.7,
}

export function sfxGain(name: AudioSfxName, masterVolume: number): number {
  const volume = Number.isFinite(masterVolume) ? Math.max(0, Math.min(1, masterVolume)) : 0
  return Math.min(1, volume * SFX_GAINS[name])
}
