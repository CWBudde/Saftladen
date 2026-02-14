export type SeededRng = {
  nextFloat: () => number
  nextInt: (minInclusive: number, maxInclusive: number) => number
  getSeed: () => number
  getCalls: () => number
  reseed: (nextSeed: number) => void
}

function normalizeSeed(seed: number): number {
  return (Math.floor(seed) >>> 0) || 1
}

export function createSeededRng(initialSeed: number): SeededRng {
  let seed = normalizeSeed(initialSeed)
  let state = seed
  let calls = 0

  const nextFloat = () => {
    calls += 1
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const nextInt = (minInclusive: number, maxInclusive: number) => {
    if (maxInclusive <= minInclusive) {
      return minInclusive
    }

    const span = maxInclusive - minInclusive + 1
    return minInclusive + Math.floor(nextFloat() * span)
  }

  const reseed = (nextSeed: number) => {
    seed = normalizeSeed(nextSeed)
    state = seed
    calls = 0
  }

  return {
    nextFloat,
    nextInt,
    getSeed: () => seed,
    getCalls: () => calls,
    reseed,
  }
}
