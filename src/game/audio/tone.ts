export type SoundLayer = {
  startMs?: number
  durationMs: number
  frequencyHz: number
  endFrequencyHz?: number
  gain: number
  shape?: 'sine' | 'triangle'
  noiseMix?: number
  noiseColor?: 'bright' | 'warm'
  attackMs?: number
  decay?: number
  seed?: number
}

export type SoundRecipe = { layers: readonly SoundLayer[] }
export const SFX_SAMPLE_RATE = 22_050

/** Bake layers into one bounded voice, using only asset-local noise streams. */
export function synthesizeSound(recipe: SoundRecipe): Int16Array {
  const durationMs = Math.max(
    ...recipe.layers.map((layer) => (layer.startMs ?? 0) + layer.durationMs),
  )
  const mixed = new Float64Array(Math.ceil((durationMs * SFX_SAMPLE_RATE) / 1000))
  for (const layer of recipe.layers) {
    const start = Math.round(((layer.startMs ?? 0) * SFX_SAMPLE_RATE) / 1000)
    const count = Math.floor((layer.durationMs * SFX_SAMPLE_RATE) / 1000)
    const attack = Math.max(1, ((layer.attackMs ?? 2) * SFX_SAMPLE_RATE) / 1000)
    const release = Math.max(1, Math.min(count / 3, (12 * SFX_SAMPLE_RATE) / 1000))
    let phase = 0
    let noiseSeed = layer.seed ?? 0x6d2b79f5
    let previousNoise = 0
    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count - 1)
      const frequency =
        layer.frequencyHz +
        ((layer.endFrequencyHz ?? layer.frequencyHz) - layer.frequencyHz) * progress
      phase += (2 * Math.PI * frequency) / SFX_SAMPLE_RATE
      noiseSeed ^= noiseSeed << 13
      noiseSeed ^= noiseSeed >>> 17
      noiseSeed ^= noiseSeed << 5
      const white = ((noiseSeed >>> 0) / 0xffffffff) * 2 - 1
      const lowPass = previousNoise * 0.78 + white * 0.22
      const noise = layer.noiseColor === 'warm' ? lowPass : (white - lowPass) * 0.65
      previousNoise = lowPass
      const wave =
        layer.shape === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase)
      const blend = layer.noiseMix ?? 0
      const envelope =
        Math.min(1, i / attack, (count - 1 - i) / release) * (1 - progress) ** (layer.decay ?? 1)
      mixed[start + i] += (wave * (1 - blend) + noise * blend) * envelope * layer.gain
    }
  }
  // Consistent headroom, without boosting quiet UI/expiry cues.
  let peak = 0
  for (const sample of mixed) peak = Math.max(peak, Math.abs(sample))
  const attenuation = peak > 0.88 ? 0.88 / peak : 1
  return Int16Array.from(mixed, (sample) => Math.round(sample * attenuation * 32_767))
}

export function encodeWavPcm16(samples: Int16Array): ArrayBuffer {
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SFX_SAMPLE_RATE, true)
  view.setUint32(28, SFX_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true)
  return buffer
}

export function createSoundObjectUrl(recipe: SoundRecipe): string {
  return URL.createObjectURL(
    new Blob([encodeWavPcm16(synthesizeSound(recipe))], { type: 'audio/wav' }),
  )
}
