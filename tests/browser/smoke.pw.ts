import { expect, test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

type DrawnFruit = { x: number; y: number; radius: number }
type BrowserProbe = {
  fruit: DrawnFruit[]
  audibleSfxStarts: number
  musicVolumes: number[]
}

declare global {
  interface Window { __browserProbe: BrowserProbe }
}

// Observe browser APIs, never reach into React or mutate the game engine.
const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await use(errors)
    expect(errors, 'Uncaught browser exceptions').toEqual([])
  }, { auto: true }],
})

async function openGame(page: Page, muted = false) {
  await page.addInitScript(({ muted }) => {
    window.__browserProbe = { fruit: [], audibleSfxStarts: 0, musicVolumes: [] }
    // Playwright mocks performance/RAF but native PointerEvent.timeStamp stays
    // on the real clock. Keep input age/velocity on the same simulated clock.
    Object.defineProperty(Event.prototype, 'timeStamp', {
      configurable: true, get: () => performance.now(),
    })
    if (muted) {
      localStorage.setItem('saftladen.ui.settings', JSON.stringify({
        schemaVersion: 1, musicVolume: 0, sfxVolume: 0, sliceSensitivity: 1, reducedMotion: true,
      }))
    }
    const originalClear = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      window.__browserProbe.fruit = []
      return originalClear.apply(this, args)
    }
    const originalDraw = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D, source: CanvasImageSource, ...coordinates: number[]
    ) {
      if (source instanceof HTMLImageElement && /\/(apple|banana|melon|orange|pineapple|starfruit)1-/.test(source.src)) {
        const matrix = this.getTransform()
        const dpr = window.devicePixelRatio
        window.__browserProbe.fruit.push({
          x: matrix.e / dpr, y: matrix.f / dpr,
          radius: Math.abs(coordinates[2]) * Math.hypot(matrix.a, matrix.b) / dpr / 2,
        })
      }
      return Reflect.apply(originalDraw, this, [source, ...coordinates])
    }
    const originalStart = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer && this.buffer.duration > 0.01) window.__browserProbe.audibleSfxStarts += 1
      return originalStart.apply(this, args)
    }
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      if (/music-.*\.mp3/.test(this.src)) window.__browserProbe.musicVolumes.push(this.volume)
      return originalPlay.call(this)
    }
  }, { muted })
  await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') })
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  // Freeze after real network/decode work; runFor still executes every RAF tick.
  await page.clock.pauseAt(new Date('2025-01-02T00:00:00Z'))
}

async function advance(page: Page, ms: number) {
  await page.clock.runFor(ms)
}

async function swipeVisibleFruit(page: Page) {
  let fruit: DrawnFruit | undefined
  // Condition-driven stepping finds a genuinely rendered opening fruit.
  for (let elapsed = 0; elapsed < 5_000 && !fruit; elapsed += 100) {
    await advance(page, 100)
    fruit = await page.evaluate(() => window.__browserProbe.fruit.find((item) =>
      item.y > Math.max(180, item.radius * 3 + 110) && item.y < innerHeight - Math.max(80, item.radius * 3) &&
      item.x > item.radius * 2 && item.x < innerWidth - item.radius * 2))
  }
  expect(fruit, 'An opening fruit should be rendered inside the canvas').toBeDefined()
  if (!fruit) throw new Error('No visible opening fruit')
  const canvas = await page.locator('canvas').boundingBox()
  if (!canvas) throw new Error('Canvas is missing')
  const score = Number(await page.locator('.hud-score strong').innerText())
  // Slash along the ascent so the fruit's next physics step remains on the
  // stroke, even while a small portrait fruit travels a radius in one frame.
  const span = Math.max(60, fruit.radius * 2)
  await page.mouse.move(canvas.x + fruit.x, canvas.y + fruit.y + span)
  await page.mouse.down()
  await advance(page, 1)
  await page.mouse.move(canvas.x + fruit.x, canvas.y + fruit.y - span)
  await page.mouse.up()
  await advance(page, 32)
  await expect(page.locator('.hud-score strong')).not.toHaveText(String(score))
}

for (const mode of ['Classic', 'Arcade', 'Zen']) {
  test(`${mode}: menu, pause/resume, natural results and replay`, async ({ page }) => {
    await openGame(page)
    await page.getByRole('button', { name: mode, exact: true }).click()
    await advance(page, 32)
    await expect(page.locator('.hud-score strong')).toHaveText('0')
    if (mode === 'Classic') await expect(page.locator('.hud-lives span:not(.lost)')).toHaveCount(3)
    else await expect(page.locator('.hud-timer')).toContainText(mode === 'Arcade' ? '60s' : '90s')
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    const paused = page.getByRole('dialog', { name: 'Run Paused' })
    await expect(paused).toBeVisible()
    const pausedText = await paused.innerText()
    await advance(page, 5_000)
    await expect(paused).toHaveText(pausedText, { useInnerText: true })
    await page.getByRole('button', { name: 'Resume', exact: true }).click()
    await expect(paused).toHaveCount(0)
    // No slicing: Classic naturally ends on misses; timed modes reach their deadlines.
    await advance(page, mode === 'Zen' ? 91_000 : mode === 'Arcade' ? 61_000 : 20_000)
    const results = page.getByRole('dialog', { name: 'Run Complete' })
    await expect(results).toBeVisible()
    await expect(results).toContainText('Fruit sliced')
    await expect(results).toContainText('Misses')
    await expect(results).toContainText('Bomb hits')
    await expect(results).toContainText('at least 5 seconds')
    await page.getByRole('button', { name: 'Run Again', exact: true }).click()
    await advance(page, 32)
    await expect(results).toHaveCount(0)
    await expect(page.locator('.hud-score strong')).toHaveText('0')
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click()
    await expect(page.getByRole('button', { name: mode, exact: true })).toBeVisible()
  })
}

test('320px fruit contact stays aligned after landscape resize', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openGame(page)
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320)
  await page.getByRole('button', { name: 'Zen', exact: true }).click()
  await swipeVisibleFruit(page)
  const score = Number(await page.locator('.hud-score strong').innerText())
  expect(score).toBeGreaterThan(0)
  await page.setViewportSize({ width: 844, height: 390 })
  await advance(page, 32)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await swipeVisibleFruit(page)
  expect(Number(await page.locator('.hud-score strong').innerText())).toBeGreaterThan(score)
  const rect = await page.locator('.hud-main').boundingBox()
  expect(rect?.height).toBeLessThan(110)
})

test('profile traps focus, settings persist, and landscape controls scroll into view', async ({ page }) => {
  await openGame(page)
  const opener = page.getByRole('button', { name: 'Profile & Rewards', exact: true })
  await opener.click()
  const profile = page.getByRole('dialog', { name: 'Profile & Rewards' })
  await expect(profile).toBeVisible()
  await expect(profile).toHaveJSProperty('open', true)
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab')
    expect(await profile.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
  }
  await page.getByRole('checkbox', { name: 'Reduce motion and flashes' }).check()
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(profile).toHaveCount(0)
  await expect(opener).toBeFocused()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  await expect(page.locator('main')).toHaveAttribute('data-reduced-motion', 'true')
  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: 'Zen', exact: true }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const motion = page.getByRole('checkbox', { name: 'Reduce motion and flashes' })
  await motion.scrollIntoViewIfNeeded()
  const box = await motion.boundingBox()
  expect(box && box.y >= 0 && box.y + box.height <= 390).toBe(true)
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused()
})

test('saved zero volume applies before the first gesture and music playback', async ({ page }) => {
  await openGame(page, true)
  await page.getByRole('button', { name: 'Classic', exact: true }).click()
  await advance(page, 250)
  expect(await page.evaluate(() => window.__browserProbe.audibleSfxStarts)).toBe(0)
  expect(await page.evaluate(() => window.__browserProbe.musicVolumes)).toEqual([])
  await page.getByRole('button', { name: 'Play music', exact: true }).click()
  await advance(page, 250)
  const volumes = await page.evaluate(() => window.__browserProbe.musicVolumes)
  expect(volumes.length).toBeGreaterThan(0)
  expect(volumes.every((volume) => volume === 0)).toBe(true)
})

test('loading artwork gates start and a failed sprite can be retried', async ({ page }) => {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/bomb-*.png', async (route) => {
    await held
    await route.abort()
  })
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  const classic = page.getByRole('button', { name: 'Classic', exact: true })
  await expect(page.getByText('Preparing game artwork…', { exact: true })).toBeVisible()
  await expect(classic).toBeDisabled()
  await expect(page.getByRole('progressbar', { name: 'Artwork loading progress' })).toBeVisible()
  release()
  await expect(page.getByRole('button', { name: 'Retry artwork', exact: true })).toBeVisible()
  await expect(classic).toBeDisabled()
  await page.unroute('**/bomb-*.png')
  await page.getByRole('button', { name: 'Retry artwork', exact: true }).click()
  await expect(classic).toBeEnabled()
  await classic.click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('simple artwork fallback is an explicit choice after loading fails', async ({ page }) => {
  await page.route('**/bomb-*.png', (route) => route.abort())
  await page.goto('./')
  const classic = page.getByRole('button', { name: 'Classic', exact: true })
  await expect(classic).toBeDisabled()
  await page.getByRole('button', { name: 'Play with simple artwork', exact: true }).click()
  await expect(classic).toBeEnabled()
  await classic.click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})
