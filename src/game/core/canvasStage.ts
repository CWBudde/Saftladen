export type CanvasMetrics = {
  widthCssPx: number
  heightCssPx: number
  widthDevicePx: number
  heightDevicePx: number
  dpr: number
}

function getPositiveInt(value: number): number {
  return Math.max(1, Math.floor(value))
}

export function getCanvasMetrics(canvas: HTMLCanvasElement): CanvasMetrics {
  const rect = canvas.getBoundingClientRect()
  const widthCssPx = getPositiveInt(rect.width || canvas.clientWidth)
  const heightCssPx = getPositiveInt(rect.height || canvas.clientHeight)
  const dpr = Math.max(1, window.devicePixelRatio || 1)

  return {
    widthCssPx,
    heightCssPx,
    widthDevicePx: Math.max(1, Math.round(widthCssPx * dpr)),
    heightDevicePx: Math.max(1, Math.round(heightCssPx * dpr)),
    dpr,
  }
}

export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): CanvasMetrics {
  const metrics = getCanvasMetrics(canvas)

  if (canvas.width !== metrics.widthDevicePx || canvas.height !== metrics.heightDevicePx) {
    canvas.width = metrics.widthDevicePx
    canvas.height = metrics.heightDevicePx
  }

  // Keep all draw coordinates in CSS pixels while backing store remains device-pixel sharp.
  ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)

  return metrics
}
