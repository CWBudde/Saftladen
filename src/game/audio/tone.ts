type WaveShape = 'sine' | 'square' | 'triangle'

type ToneOptions = {
  frequencyHz: number
  endFrequencyHz?: number
  durationMs: number
  volume?: number
  sampleRate?: number
  shape?: WaveShape
  /** Blend a short noise transient into the tone for swishes and impacts. */
  noiseMix?: number
}

function encodeWavPcm16(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // sampleRate * channels * bytesPerSample
  view.setUint16(32, 2, true) // blockAlign
  view.setUint16(34, 16, true) // bitsPerSample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(44 + i * 2, samples[i], true)
  }

  return buffer
}

function toWaveSample(shape: WaveShape, phase: number): number {
  if (shape === 'square') {
    return Math.sin(phase) >= 0 ? 1 : -1
  }
  if (shape === 'triangle') {
    return (2 / Math.PI) * Math.asin(Math.sin(phase))
  }
  return Math.sin(phase)
}

export function createToneObjectUrl(options: ToneOptions): string {
  const sampleRate = options.sampleRate ?? 22_050
  const durationMs = Math.max(30, options.durationMs)
  const sampleCount = Math.max(1, Math.floor((sampleRate * durationMs) / 1000))
  const volume = Math.min(1, Math.max(0, options.volume ?? 0.6))
  const shape = options.shape ?? 'sine'
  const noiseMix = Math.min(1, Math.max(0, options.noiseMix ?? 0))
  const attackSamples = Math.floor(sampleCount * 0.04)
  const releaseSamples = Math.floor(sampleCount * 0.22)
  const bodySamples = Math.max(0, sampleCount - attackSamples - releaseSamples)

  const startFreq = options.frequencyHz
  const endFreq = options.endFrequencyHz ?? options.frequencyHz
  const hasSweep = startFreq !== endFreq

  const pcm = new Int16Array(sampleCount)
  let phase = 0
  let noiseSeed = 0x6d2b79f5
  let previousNoise = 0

  for (let i = 0; i < sampleCount; i += 1) {
    let envelope = 1
    if (i < attackSamples) {
      envelope = i / Math.max(1, attackSamples)
    } else if (i > attackSamples + bodySamples) {
      const releaseIndex = i - attackSamples - bodySamples
      envelope = 1 - releaseIndex / Math.max(1, releaseSamples)
    }

    const t = i / sampleCount
    const freq = hasSweep ? startFreq + (endFreq - startFreq) * t : startFreq
    phase += (2 * Math.PI * freq) / sampleRate
    // A local seeded noise stream makes each generated asset repeatable and
    // independent of gameplay randomness. The transient decays into the tone.
    noiseSeed ^= noiseSeed << 13
    noiseSeed ^= noiseSeed >>> 17
    noiseSeed ^= noiseSeed << 5
    const whiteNoise = (noiseSeed >>> 0) / 0xffffffff * 2 - 1
    const filteredNoise = whiteNoise * 0.65 + previousNoise * 0.35
    previousNoise = filteredNoise
    const transient = noiseMix * (1 - t) ** 1.5
    const signal = toWaveSample(shape, phase) * (1 - transient) + filteredNoise * transient
    const sample = signal * envelope * volume
    pcm[i] = Math.max(-1, Math.min(1, sample)) * 32_767
  }

  const wavBuffer = encodeWavPcm16(pcm, sampleRate)
  const blob = new Blob([wavBuffer], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}
