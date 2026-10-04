import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import type { ProfileSample } from './fixture'

const percentile = (values: number[], fraction: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]

test('production renderer: static board and synthetic Frenzy-sized effects', async ({
  browser,
}) => {
  const reports = []
  for (const dpr of [1, 3]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: dpr,
      serviceWorkers: 'block',
    })
    const page = await context.newPage()
    await page.goto('/tests/browser/performance/index.html')
    await page.waitForFunction(() => typeof window.profileRenderer === 'function')
    for (const dojo of ['great-wave', 'sunset-harbor', 'storm-temple'] as const) {
      for (const stress of [false, true]) {
        const sample: ProfileSample = await page.evaluate(
          async ({ dojo, stress }) => window.profileRenderer(dojo, stress, 120),
          { dojo, stress },
        )
        expect(
          sample.unchanged,
          'Renderer must preserve scoring, timers, entities and both RNG streams',
        ).toBe(true)
        expect(sample.cpuMs).toHaveLength(120)
        const report = {
          dojo,
          stress,
          dpr,
          frames: sample.frames,
          cpuMedianMs: percentile(sample.cpuMs, 0.5),
          cpuP95Ms: percentile(sample.cpuMs, 0.95),
          rafP95Ms: percentile(sample.intervalsMs, 0.95),
          missedFramePercent:
            (sample.intervalsMs.filter((ms) => ms > 25).length / sample.frames) * 100,
        }
        reports.push(report)
        console.log(JSON.stringify(report))
      }
    }
    await context.close()
  }
  const label = process.env.PERFORMANCE_LABEL ?? 'latest'
  if (!/^[a-z0-9-]+$/.test(label))
    throw new Error('PERFORMANCE_LABEL must contain only lowercase letters, digits and hyphens')
  await mkdir('output/performance-reports', { recursive: true })
  await writeFile(
    `output/performance-reports/${label}.json`,
    JSON.stringify(
      {
        browser: browser.version(),
        viewport: '390x844',
        warmupFrames: 60,
        measuredFrames: 120,
        budgets: { rendererCpuP95Ms: 8, rafIntervalP95Ms: 20, inputToFrameP95Ms: 50 },
        limitations:
          'Headless host with synthetic stationary render load. CPU submission excludes asynchronous raster/compositing; no physical input, end-to-end latency or long-session memory claim. Budgets are provisional physical-device targets.',
        reports,
      },
      null,
      2,
    ),
  )
})
