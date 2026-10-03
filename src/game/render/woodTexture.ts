/** Deterministic presentation-only texture; never consumes gameplay RNG. */
function seededNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453123
  return value - Math.floor(value)
}

export function createWoodTexture(width: number, height: number): HTMLCanvasElement | null {
  const surface = globalThis.document?.createElement('canvas')
  if (!surface) {
    return null
  }

  surface.width = Math.max(1, Math.floor(width))
  surface.height = Math.max(1, Math.floor(height))
  const ctx = surface.getContext('2d')
  if (!ctx) {
    return null
  }

  const base = ctx.createLinearGradient(0, 0, 0, surface.height)
  base.addColorStop(0, '#6b3f24')
  base.addColorStop(1, '#3f2215')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, surface.width, surface.height)

  let plankX = 0
  let plankIndex = 0
  while (plankX < surface.width) {
    const plankWidth = Math.max(90, Math.min(185, 110 + Math.floor(seededNoise(plankIndex * 3.21) * 75)))
    const endX = Math.min(surface.width, plankX + plankWidth)
    const lightShift = seededNoise(plankIndex * 1.73) * 0.22 - 0.11
    const plankToneTop = `hsl(26 44% ${34 + lightShift * 100}%)`
    const plankToneBottom = `hsl(24 46% ${27 + lightShift * 100}%)`
    const plankGradient = ctx.createLinearGradient(plankX, 0, plankX, surface.height)
    plankGradient.addColorStop(0, plankToneTop)
    plankGradient.addColorStop(1, plankToneBottom)
    ctx.fillStyle = plankGradient
    ctx.fillRect(plankX, 0, endX - plankX, surface.height)

    ctx.fillStyle = 'rgba(20, 10, 8, 0.26)'
    ctx.fillRect(endX - 1.2, 0, 2.4, surface.height)
    ctx.fillStyle = 'rgba(255, 214, 156, 0.08)'
    ctx.fillRect(plankX + 1, 0, 1.6, surface.height)

    const grainLines = Math.floor(surface.height / 12)
    for (let line = 0; line < grainLines; line += 1) {
      const seed = plankIndex * 101 + line * 13.11
      const yBase = (line / grainLines) * surface.height + seededNoise(seed) * 8
      const phase = seededNoise(seed + 4.2) * Math.PI * 2
      const amplitude = 2 + seededNoise(seed + 8.8) * 2.5
      ctx.strokeStyle = `rgba(255, 231, 190, ${0.05 + seededNoise(seed + 2.7) * 0.05})`
      ctx.lineWidth = 0.9
      ctx.beginPath()
      for (let x = plankX; x <= endX; x += 16) {
        const t = (x - plankX) / Math.max(1, endX - plankX)
        const y = yBase + Math.sin(t * Math.PI * 6 + phase) * amplitude
        if (x === plankX) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    const knotCount = seededNoise(plankIndex * 6.3) > 0.55 ? 1 : 0
    for (let knot = 0; knot < knotCount; knot += 1) {
      const knotSeed = plankIndex * 47 + knot * 9
      const knotX = plankX + (endX - plankX) * (0.25 + seededNoise(knotSeed + 0.9) * 0.5)
      const knotY = surface.height * (0.18 + seededNoise(knotSeed + 1.7) * 0.62)
      const knotRadius = 13 + seededNoise(knotSeed + 3.5) * 14
      ctx.fillStyle = 'rgba(26, 13, 9, 0.4)'
      ctx.beginPath()
      ctx.ellipse(knotX, knotY, knotRadius * 1.1, knotRadius, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 220, 162, 0.18)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(knotX, knotY, knotRadius * 0.72, knotRadius * 0.6, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    plankX = endX
    plankIndex += 1
  }

  for (let seam = 0; seam < 7; seam += 1) {
    const seamSeed = seam * 8.123
    const startX = seededNoise(seamSeed + 0.3) * surface.width
    const startY = seededNoise(seamSeed + 1.1) * surface.height
    const angle = (seededNoise(seamSeed + 2.8) - 0.5) * 1.3
    const length = surface.width * (0.45 + seededNoise(seamSeed + 5.2) * 0.4)
    const endX = startX + Math.cos(angle) * length
    const endY = startY + Math.sin(angle) * length

    ctx.strokeStyle = 'rgba(22, 10, 7, 0.22)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255, 223, 166, 0.09)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(startX + 1.2, startY + 1.2)
    ctx.lineTo(endX + 1.2, endY + 1.2)
    ctx.stroke()
  }

  const vignette = ctx.createRadialGradient(
    surface.width * 0.5,
    surface.height * 0.46,
    surface.width * 0.18,
    surface.width * 0.5,
    surface.height * 0.5,
    Math.max(surface.width, surface.height) * 0.72,
  )
  vignette.addColorStop(0, 'rgba(255, 230, 188, 0.08)')
  vignette.addColorStop(1, 'rgba(16, 8, 6, 0.33)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, surface.width, surface.height)

  return surface
}
