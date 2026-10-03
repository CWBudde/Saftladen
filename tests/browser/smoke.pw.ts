import { expect, test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

type DrawnFruit = { x: number; y: number; radius: number }
type BrowserProbe = {
  fruit: DrawnFruit[]
  bombs: DrawnFruit[]
  impactRings: string[]
  impactLabels: string[]
  audibleSfxStarts: number
  sfxSamples: { duration: number; peak: number; rate: number }[]
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

async function openGame(page: Page, muted = false, seenOnboarding = true) {
  await page.addInitScript(({ muted, seenOnboarding }) => {
    window.__browserProbe = { fruit: [], bombs: [], impactRings: [], impactLabels: [], audibleSfxStarts: 0, sfxSamples: [], musicVolumes: [] }
    if (seenOnboarding) localStorage.setItem('saftladen.onboarding.v1', 'seen')
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
      window.__browserProbe.bombs = []
      window.__browserProbe.impactRings = []
      window.__browserProbe.impactLabels = []
      return originalClear.apply(this, args)
    }
    const originalDraw = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D, source: CanvasImageSource, ...coordinates: number[]
    ) {
      if (source instanceof HTMLImageElement && /\/((apple|banana|melon|orange|pineapple|starfruit)1|bomb)-/.test(source.src)) {
        const matrix = this.getTransform()
        const dpr = window.devicePixelRatio
        const collection = /\/bomb-/.test(source.src) ? window.__browserProbe.bombs : window.__browserProbe.fruit
        collection.push({
          x: matrix.e / dpr, y: matrix.f / dpr,
          radius: Math.abs(coordinates[2]) * Math.hypot(matrix.a, matrix.b) / dpr / 2,
        })
      }
      return Reflect.apply(originalDraw, this, [source, ...coordinates])
    }
    const originalArc = CanvasRenderingContext2D.prototype.arc
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (this.strokeStyle === '#fb923c' || (this.strokeStyle === '#fde047' && this.lineWidth > 2)) {
        window.__browserProbe.impactRings.push(String(this.strokeStyle))
      }
      return originalArc.apply(this, args)
    }
    const originalText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (text.startsWith('BOMB')) window.__browserProbe.impactLabels.push(text)
      return originalText.call(this, text, ...args)
    }
    const originalStart = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer && this.buffer.duration > 0.01) {
        window.__browserProbe.audibleSfxStarts += 1
        let peak = 0
        for (const sample of this.buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(sample))
        const entry = { duration: this.buffer.duration, peak, rate: this.playbackRate.value }
        window.__browserProbe.sfxSamples.push(entry)
        if (window.__browserProbe.sfxSamples.length > 32) window.__browserProbe.sfxSamples.shift()
        queueMicrotask(() => { entry.rate = this.playbackRate.value })
      }
      return originalStart.apply(this, args)
    }
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      if (/music-.*\.mp3/.test(this.src)) window.__browserProbe.musicVolumes.push(this.volume)
      return originalPlay.call(this)
    }
  }, { muted, seenOnboarding })
  await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') })
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  // Freeze after real network/decode work; runFor still executes every RAF tick.
  await page.clock.pauseAt(new Date('2025-01-02T00:00:00Z'))
}

async function advance(page: Page, ms: number) {
  await page.clock.runFor(ms)
}

async function startMode(page: Page, mode: string) {
  await page.getByRole('button', { name: mode, exact: true }).click()
  await expect(page.getByRole('dialog', { name: `Ready for ${mode}?`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
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
  // Horizontal contact at the last drawn center must survive the next physics
  // step, even when an ascending portrait fruit moves farther than its radius.
  const span = Math.max(60, fruit.radius * 2)
  await page.mouse.move(canvas.x + fruit.x - span, canvas.y + fruit.y)
  await page.mouse.down()
  await advance(page, 1)
  await page.mouse.move(canvas.x + fruit.x + span, canvas.y + fruit.y)
  await page.mouse.up()
  await advance(page, 32)
  await expect(page.locator('.hud-score strong')).not.toHaveText(String(score))
}

for (const mode of ['Classic', 'Arcade', 'Zen']) {
  test(`${mode}: menu, pause/resume, natural results and replay`, async ({ page }) => {
    await openGame(page)
    await startMode(page, mode)
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
    await expect(results).toContainText('Best stroke combo')
    await expect(results).toContainText('Stroke accuracy')
    await expect(results).toContainText('at least 5 seconds')
    await page.getByRole('button', { name: 'Run Again', exact: true }).click()
    await page.getByRole('button', { name: 'Start now', exact: true }).click()
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
  await startMode(page, 'Zen')
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

test('one held gesture cuts a rendered fruit group and reports a stroke combo', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openGame(page)
  await startMode(page, 'Zen')
  let group: DrawnFruit[] = []
  for (let elapsed = 0; elapsed < 30_000 && group.length < 3; elapsed += 100) {
    await advance(page, 100)
    group = await page.evaluate(() => window.__browserProbe.fruit.filter((item) =>
      item.y > 135 && item.y < innerHeight - Math.max(50, item.radius * 2) &&
      item.x > 50 && item.x < innerWidth - 50).slice(0, 3))
  }
  expect(group.length, 'The Zen director should provide a visible combo group').toBe(3)
  group.sort((a, b) => a.x - b.x)
  const canvas = await page.locator('canvas').boundingBox()
  if (!canvas) throw new Error('Canvas is missing')
  await page.mouse.move(canvas.x + group[0].x - 45, canvas.y + group[0].y)
  await page.mouse.down()
  for (const fruit of group) {
    await advance(page, 1)
    await page.mouse.move(canvas.x + fruit.x, canvas.y + fruit.y)
  }
  await advance(page, 1)
  await page.mouse.move(canvas.x + group[2].x + 45, canvas.y + group[2].y)
  await page.mouse.up()
  await advance(page, 32)
  await expect(page.locator('.hud-effects')).toContainText('Stroke combo')
  expect(await page.evaluate(() => window.__browserProbe.impactRings.filter(color => color === '#fde047').length)).toBeGreaterThan(0)
  expect(Number(await page.locator('.hud-score strong').innerText())).toBeGreaterThanOrEqual(45)
  // Real WebAudio decoding/playback covers the generated layered WAVs, including
  // the combo chord. Headroom is measured before the user's master gain.
  await expect.poll(async () => page.evaluate(() =>
    window.__browserProbe.sfxSamples.some(sample => Math.abs(sample.duration - 0.248) < 0.001))).toBe(true)
  const samples = await page.evaluate(() => window.__browserProbe.sfxSamples)
  expect(samples.length).toBeGreaterThanOrEqual(4)
  expect(samples.every(sample => sample.peak > 0 && sample.peak <= 0.881)).toBe(true)
  expect(samples.every(sample => sample.rate >= 0.8 && sample.rate <= 1.4)).toBe(true)
  await advance(page, 91_000)
  const results = page.getByRole('dialog', { name: 'Run Complete' })
  const bestStroke = results.locator('.result-stats > div').filter({ has: page.getByText('Best stroke combo', { exact: true }) })
  expect(Number.parseInt(await bestStroke.locator('dd').innerText(), 10)).toBeGreaterThanOrEqual(3)
  await expect(results.locator('.result-stats')).toContainText('Stroke accuracy100% (1/1)')
})

for (const reducedMotion of [false, true]) {
  test(`bomb impact is readable and expires with reduced motion ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await openGame(page, reducedMotion)
    await startMode(page, 'Arcade')
    let bomb: DrawnFruit | undefined
    for (let elapsed = 0; elapsed < 30_000 && !bomb; elapsed += 100) {
      await advance(page, 100)
      bomb = await page.evaluate(() => window.__browserProbe.bombs.find(item =>
        item.y > 160 && item.y < innerHeight - 50 && item.x > 60 && item.x < innerWidth - 60))
    }
    expect(bomb, 'The director should offer a visible Arcade bomb after its safe opening').toBeDefined()
    if (!bomb) throw new Error('No visible bomb')
    const timer = await page.locator('.hud-timer strong').innerText()
    const score = await page.locator('.hud-score strong').innerText()
    await page.mouse.move(bomb.x - 8, bomb.y)
    await page.mouse.down()
    await advance(page, 1)
    await page.mouse.move(bomb.x + 8, bomb.y)
    await page.mouse.up()
    await advance(page, 32)
    expect(await page.evaluate(() => window.__browserProbe.impactLabels)).toContain('BOMB HIT')
    const rings = await page.evaluate(() => window.__browserProbe.impactRings.filter(color => color === '#fb923c').length)
    if (reducedMotion) expect(rings).toBe(0)
    else expect(rings).toBeGreaterThan(0)
    await expect(page.locator('.hud-score strong')).toHaveText(score)
    const timerAfterHit = await page.locator('.hud-timer strong').innerText()
    expect(Number.parseInt(timerAfterHit, 10)).toBeGreaterThanOrEqual(Number.parseInt(timer, 10) - 1)
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await advance(page, 800)
    expect(await page.evaluate(() => window.__browserProbe.impactLabels)).toEqual([])
    expect(await page.evaluate(() => window.__browserProbe.impactRings)).toEqual([])
    await expect(page.locator('.hud-timer strong')).toHaveText(timerAfterHit)
  })
}

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
  await startMode(page, 'Zen')
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
  await startMode(page, 'Classic')
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
  await page.addInitScript(() => localStorage.setItem('saftladen.onboarding.v1', 'seen'))
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
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('simple artwork fallback is an explicit choice after loading fails', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saftladen.onboarding.v1', 'seen'))
  await page.route('**/bomb-*.png', (route) => route.abort())
  await page.goto('./')
  const classic = page.getByRole('button', { name: 'Classic', exact: true })
  await expect(classic).toBeDisabled()
  await page.getByRole('button', { name: 'Play with simple artwork', exact: true }).click()
  await expect(classic).toBeEnabled()
  await classic.click()
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('Saftladen identity stays readable and controls fit portrait and landscape', async ({ page }, testInfo) => {
  await openGame(page)
  await expect(page.getByRole('heading', { name: 'Saftladen.', exact: true })).toBeVisible()
  const appearance = await page.locator('.mode-guide').evaluate((guide) => {
    const style = getComputedStyle(guide)
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const s = value / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const background = luminance(style.backgroundColor)
    const contrast = (color: string) => {
      const foreground = luminance(color)
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
    }
    return {
      contrast: [contrast(style.color), contrast(getComputedStyle(guide.querySelector('.slice-guide')!).color),
        contrast(getComputedStyle(guide.querySelector('strong')!).color)],
      font: style.fontFamily,
      buttonFont: getComputedStyle(document.querySelector('.profile-button')!).fontFamily,
    }
  })
  expect(appearance.contrast.every(ratio => ratio >= 4.5)).toBe(true)
  expect(appearance.buttonFont).toBe(appearance.font)
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await advance(page, 32)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
    const brand = await page.locator('.menu-logo').boundingBox()
    expect(brand && brand.x >= 0 && brand.x + brand.width <= viewport.width).toBe(true)
    for (const name of ['Classic', 'Arcade', 'Zen', 'How to play', 'Profile & Rewards']) {
      const control = page.getByRole('button', { name, exact: true })
      await control.scrollIntoViewIfNeeded()
      const box = await control.boundingBox()
      expect(box && box.width >= 44 && box.height >= 44 && box.x >= 0 &&
        box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath(`menu-${viewport.width}.png`) })
  }
})

async function practiceGesture(page: Page, gesture: 'stationary' | 'miss' | 'slice') {
  const canvas = page.getByLabel('Practice slicing canvas', { exact: true })
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Practice canvas is missing')
  const y = box.y + (gesture === 'miss' ? 18 : box.height / 2)
  const startX = box.x + box.width / 2 - (gesture === 'stationary' ? 0 : 60)
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await advance(page, 1)
  if (gesture !== 'stationary') await page.mouse.move(box.x + box.width / 2 + 60, y)
  await page.mouse.up()
}

test('first-run practice teaches slicing without changing rewards and remains available later', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openGame(page, false, false)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))).not.toBeNull()
  const profileBefore = await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))
  await page.getByRole('button', { name: 'Zen', exact: true }).click()
  const help = page.getByRole('dialog', { name: 'How to play', exact: true })
  await expect(help).toBeVisible()
  await expect(help).toContainText('3 or more fruit in one held swipe')
  await expect(help).toContainText('Three missed fruit')
  await expect(help).toContainText('60 seconds')
  await expect(help).toContainText('90 seconds')
  await advance(page, 5_000)
  await expect(page.locator('.hud-score')).toHaveCount(0)
  await practiceGesture(page, 'stationary')
  await expect(help.locator('.practice-feedback')).toHaveText('Try again: swipe across the apple.')
  await practiceGesture(page, 'miss')
  await expect(help.locator('.practice-feedback')).toHaveText('Try again: swipe across the apple.')
  await page.getByRole('button', { name: 'Practice again', exact: true }).click()
  await expect(help.locator('.practice-feedback')).toHaveText('Swipe across the apple.')
  await practiceGesture(page, 'slice')
  await expect(help.locator('.practice-feedback')).toHaveText('Nice slice! Ready for the game.')
  await page.getByRole('button', { name: 'Practice again', exact: true }).click()
  await expect(help.locator('.practice-feedback')).toHaveText('Swipe across the apple.')
  await practiceGesture(page, 'slice')
  await expect(help.locator('.practice-feedback')).toHaveText('Nice slice! Ready for the game.')
  expect(await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))).toBe(profileBefore)
  await page.getByRole('button', { name: 'Play Zen', exact: true }).click()
  const ready = page.getByRole('dialog', { name: 'Ready for Zen?', exact: true })
  await expect(ready).toBeVisible()
  await advance(page, 32)
  expect(await ready.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
  expect(await page.evaluate(() => localStorage.getItem('saftladen.onboarding.v1'))).toBe('seen')
  await page.getByRole('button', { name: 'Back to menu', exact: true }).click()
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await expect(help).toBeVisible()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await advance(page, 32)
  await expect(page.getByRole('button', { name: 'How to play', exact: true })).toBeFocused()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Arcade', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Ready for Arcade?', exact: true })).toBeVisible()
  await expect(help).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to menu', exact: true }).click()
  expect(await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))).toBe(profileBefore)
})

test('short landscape onboarding supports reduced motion, keyboard focus, cancel and skip', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openGame(page, true, false)
  await page.getByRole('button', { name: 'Classic', exact: true }).click()
  const help = page.getByRole('dialog', { name: 'How to play', exact: true })
  await expect(help).toBeVisible()
  await expect(page.locator('main')).toHaveAttribute('data-reduced-motion', 'true')
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab')
    expect(await help.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
  }
  const back = page.getByRole('button', { name: 'Back to menu', exact: true })
  await back.scrollIntoViewIfNeeded()
  const backBox = await back.boundingBox()
  expect(backBox && backBox.y >= 0 && backBox.y + backBox.height <= 390).toBe(true)
  await back.focus()
  await page.keyboard.press('Enter')
  await advance(page, 32)
  await expect(help).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('saftladen.onboarding.v1'))).toBeNull()
  await page.getByRole('button', { name: 'Arcade', exact: true }).click()
  await expect(help).toBeVisible()
  const skip = page.getByRole('button', { name: 'Skip practice', exact: true })
  await skip.scrollIntoViewIfNeeded()
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Ready for Arcade?', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('saftladen.onboarding.v1'))).toBe('seen')
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.hud-score')).toHaveCount(0)
})

for (const mode of ['Arcade', 'Zen']) {
  test(`${mode}: countdown cancels and suspends in the background without spending run time`, async ({ page }) => {
    await openGame(page, true)
    const ready = page.getByRole('dialog', { name: `Ready for ${mode}?`, exact: true })
    await page.getByRole('button', { name: mode, exact: true }).click()
    await expect(ready.locator('.ready-number')).toHaveText('3')
    await advance(page, 1_000)
    await expect(ready.locator('.ready-number')).toHaveText('2')
    await expect(page.locator('.hud-score')).toHaveCount(0)
    await page.getByRole('button', { name: 'Back to menu', exact: true }).click()
    await advance(page, 5_000)
    await expect(ready).toHaveCount(0)
    await expect(page.locator('.hud-score')).toHaveCount(0)

    await page.getByRole('button', { name: mode, exact: true }).click()
    await advance(page, 1_000)
    await expect(ready.locator('.ready-number')).toHaveText('2')
    if (mode === 'Arcade') {
      await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    } else {
      // Model document visibility at the browser boundary; no engine state is changed.
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }
    await advance(page, 10_000)
    await expect(ready).toContainText('Countdown paused.')
    await expect(page.locator('.hud-score')).toHaveCount(0)
    if (mode === 'Zen') {
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: false })
        document.dispatchEvent(new Event('visibilitychange'))
      })
    } else await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    // Returning to the foreground requires the user's explicit continuation.
    await advance(page, 5_000)
    await expect(page.getByRole('button', { name: 'Continue countdown', exact: true })).toBeVisible()
    await expect(page.locator('.hud-score')).toHaveCount(0)
    await page.getByRole('button', { name: 'Continue countdown', exact: true }).click()
    await advance(page, 1_000)
    await expect(ready.locator('.ready-number')).toHaveText('1')
    await advance(page, 1_000)
    await expect(ready).toHaveCount(0)
    await expect(page.locator('.hud-score strong')).toHaveText('0')
    await expect(page.locator('.hud-timer')).toContainText(mode === 'Arcade' ? '60s' : '90s')

    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click()
    await page.getByRole('button', { name: mode, exact: true }).click()
    await expect(ready.locator('.ready-number')).toHaveText('3')
    for (const remaining of ['2', '1']) {
      await advance(page, 1_000)
      await expect(ready.locator('.ready-number')).toHaveText(remaining)
    }
    await advance(page, 1_000)
    await expect(ready).toHaveCount(0)
    await expect(page.locator('.hud-timer')).toContainText(mode === 'Arcade' ? '60s' : '90s')
  })
}
