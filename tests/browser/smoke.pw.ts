import { expect, test as base } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type DrawnFruit = { x: number; y: number; radius: number }
type BrowserProbe = {
  fruit: DrawnFruit[]
  bombs: DrawnFruit[]
  impactRings: string[]
  impactLabels: string[]
  bladeColors: string[]
  audibleSfxStarts: number
  sfxSamples: { duration: number; peak: number; rate: number }[]
  musicVolumes: number[]
  debugDrawn: boolean
}

declare global {
  interface Window {
    __browserProbe: BrowserProbe
  }
}

// Observe browser APIs, never reach into React or mutate the game engine.
const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await use(errors)
      expect(errors, 'Uncaught browser exceptions').toEqual([])
    },
    { auto: true },
  ],
})

async function openGame(page: Page, muted = false, seenOnboarding = true) {
  await page.addInitScript(
    ({ muted, seenOnboarding }) => {
      window.__browserProbe = {
        fruit: [],
        bombs: [],
        impactRings: [],
        impactLabels: [],
        bladeColors: [],
        audibleSfxStarts: 0,
        sfxSamples: [],
        musicVolumes: [],
        debugDrawn: false,
      }
      if (seenOnboarding) localStorage.setItem('saftladen.onboarding.v1', 'seen')
      // Playwright mocks performance/RAF but native PointerEvent.timeStamp stays
      // on the real clock. Keep input age/velocity on the same simulated clock.
      Object.defineProperty(Event.prototype, 'timeStamp', {
        configurable: true,
        get: () => performance.now(),
      })
      if (muted) {
        localStorage.setItem(
          'saftladen.ui.settings',
          JSON.stringify({
            schemaVersion: 1,
            musicVolume: 0,
            sfxVolume: 0,
            sliceSensitivity: 1,
            reducedMotion: true,
          }),
        )
      }
      const originalClear = CanvasRenderingContext2D.prototype.clearRect
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.classList.contains('game-canvas')) {
          window.__browserProbe.fruit = []
          window.__browserProbe.bombs = []
          window.__browserProbe.impactRings = []
          window.__browserProbe.impactLabels = []
          window.__browserProbe.bladeColors = []
          window.__browserProbe.debugDrawn = false
        }
        return originalClear.apply(this, args)
      }
      const originalStroke = CanvasRenderingContext2D.prototype.stroke
      CanvasRenderingContext2D.prototype.stroke = function (path?: Path2D) {
        if (this.canvas.classList.contains('game-canvas'))
          window.__browserProbe.bladeColors.push(String(this.strokeStyle))
        return Reflect.apply(originalStroke, this, path ? [path] : [])
      }
      const originalDraw = CanvasRenderingContext2D.prototype.drawImage
      CanvasRenderingContext2D.prototype.drawImage = function (
        this: CanvasRenderingContext2D,
        source: CanvasImageSource,
        ...coordinates: number[]
      ) {
        if (
          source instanceof HTMLImageElement &&
          /\/((apple|banana|melon|orange|pineapple|starfruit)1|bomb)-/.test(source.src)
        ) {
          const matrix = this.getTransform()
          const dpr = window.devicePixelRatio
          const collection = /\/bomb-/.test(source.src)
            ? window.__browserProbe.bombs
            : window.__browserProbe.fruit
          collection.push({
            x: matrix.e / dpr,
            y: matrix.f / dpr,
            radius: (Math.abs(coordinates[2]) * Math.hypot(matrix.a, matrix.b)) / dpr / 2,
          })
        }
        return Reflect.apply(originalDraw, this, [source, ...coordinates])
      }
      const originalArc = CanvasRenderingContext2D.prototype.arc
      CanvasRenderingContext2D.prototype.arc = function (...args) {
        if (
          this.strokeStyle === '#fb923c' ||
          (this.strokeStyle === '#fde047' && this.lineWidth > 2)
        ) {
          window.__browserProbe.impactRings.push(String(this.strokeStyle))
        }
        return originalArc.apply(this, args)
      }
      const originalText = CanvasRenderingContext2D.prototype.fillText
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        if (text.startsWith('Debug: ON')) window.__browserProbe.debugDrawn = true
        if (text.startsWith('BOMB')) window.__browserProbe.impactLabels.push(text)
        return originalText.call(this, text, ...args)
      }
      const originalStart = AudioBufferSourceNode.prototype.start
      AudioBufferSourceNode.prototype.start = function (...args) {
        if (this.buffer && this.buffer.duration > 0.01) {
          window.__browserProbe.audibleSfxStarts += 1
          let peak = 0
          for (const sample of this.buffer.getChannelData(0))
            peak = Math.max(peak, Math.abs(sample))
          const entry = { duration: this.buffer.duration, peak, rate: this.playbackRate.value }
          window.__browserProbe.sfxSamples.push(entry)
          if (window.__browserProbe.sfxSamples.length > 32) window.__browserProbe.sfxSamples.shift()
          queueMicrotask(() => {
            entry.rate = this.playbackRate.value
          })
        }
        return originalStart.apply(this, args)
      }
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (/music-.*\.mp3/.test(this.src)) window.__browserProbe.musicVolumes.push(this.volume)
        return originalPlay.call(this)
      }
    },
    { muted, seenOnboarding },
  )
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
    fruit = await page.evaluate(() =>
      window.__browserProbe.fruit.find(
        (item) =>
          item.y > Math.max(180, item.radius * 3 + 110) &&
          item.y < innerHeight - Math.max(80, item.radius * 3) &&
          item.x > item.radius * 2 &&
          item.x < innerWidth - item.radius * 2,
      ),
    )
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
  // The 1ms clock step can cross a RAF boundary. Follow the nearest freshly
  // rendered fruit rather than aiming at a pose from before that physics step.
  const contact = await page.evaluate(
    (previous) =>
      window.__browserProbe.fruit.reduce<DrawnFruit | undefined>(
        (nearest, candidate) =>
          nearest &&
          Math.hypot(nearest.x - previous.x, nearest.y - previous.y) <=
            Math.hypot(candidate.x - previous.x, candidate.y - previous.y)
            ? nearest
            : candidate,
        undefined,
      ),
    fruit,
  )
  if (!contact) throw new Error('The selected fruit disappeared before the swipe')
  await page.mouse.move(canvas.x + contact.x, canvas.y + contact.y)
  await page.mouse.move(canvas.x + contact.x + span, canvas.y + contact.y)
  await page.mouse.up()
  await advance(page, 32)
  await expect(page.locator('.hud-score strong')).not.toHaveText(String(score))
}

async function browseEquipment(page: Page, name: string) {
  const profile = page.getByRole('dialog', { name: 'Profile & Rewards', exact: true })
  await profile.getByRole('tab', { name: 'Equipment', exact: true }).click()
  await profile
    .getByLabel('Browse equipment', { exact: true })
    .selectOption(name.endsWith('Dojo') ? 'dojo' : 'blade')
  const previous = profile.getByRole('button', { name: 'Previous', exact: true })
  while (await previous.isEnabled()) await previous.click()
  const card = profile.locator('.equipment-preview-list > li')
  for (let i = 0; i < 3; i++) {
    if (await card.getByText(name, { exact: true }).count()) return card
    const next = profile.getByRole('button', { name: 'Next', exact: true })
    if (!(await next.isEnabled())) break
    await next.click()
  }
  throw new Error(`Equipment not found: ${name}`)
}

async function openGoalCategory(page: Page, category: string) {
  const profile = page.getByRole('dialog', { name: 'Profile & Rewards', exact: true })
  await profile.getByRole('tab', { name: 'Goals', exact: true }).click()
  await profile.getByLabel('Goal category', { exact: true }).selectOption(category)
}

for (const mode of ['Classic', 'Arcade', 'Zen']) {
  test(`${mode}: menu, pause/resume, natural results and replay`, async ({ page }, testInfo) => {
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
    if (mode === 'Classic') {
      await expect(results.getByRole('button', { name: 'Run Again', exact: true })).toBeFocused()
      await expect(results.locator('details')).toHaveCount(0)
      await expect(results.getByRole('list')).toHaveCount(0)
      for (const [width, height] of [
        [390, 844],
        [320, 568],
        [844, 390],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height })
        const bounds = await results.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.height).toBeLessThanOrEqual(Math.min(480, height - 32))
        expect(bounds!.width).toBeLessThanOrEqual(height <= 500 ? 560 : 380)
        const fits = await results.evaluate((dialog) => ({
          vertical: dialog.scrollHeight <= dialog.clientHeight + 1,
          horizontal: dialog.scrollWidth <= dialog.clientWidth + 1,
        }))
        expect(fits).toEqual({ vertical: true, horizontal: true })
        for (const name of ['Run Again', 'Choose equipment', 'Main Menu']) {
          const control = await results.getByRole('button', { name, exact: true }).boundingBox()
          expect(control, `${name} at ${width}px`).not.toBeNull()
          // Transformed button bounds can round 44px to 43.999… in Chromium.
          expect(control!.height, `${name} touch target`).toBeGreaterThanOrEqual(43.99)
          expect(control!.y, `${name} top`).toBeGreaterThanOrEqual(bounds!.y)
          expect(control!.y + control!.height, `${name} bottom`).toBeLessThanOrEqual(
            bounds!.y + bounds!.height,
          )
          expect(
            await results
              .getByRole('button', { name, exact: true })
              .evaluate((button) => parseFloat(getComputedStyle(button).minHeight)),
          ).toBeGreaterThanOrEqual(44)
        }
        await page.screenshot({ path: testInfo.outputPath(`results-${width}.png`) })
      }
      await page.setViewportSize({ width: 390, height: 844 })
    }
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

test('one held gesture cuts a rendered fruit group and reports a stroke combo', async ({
  page,
}) => {
  test.setTimeout(90_000) // Render every RAF tick of a full run after finding a combo group.
  await page.setViewportSize({ width: 844, height: 390 })
  await openGame(page)
  await startMode(page, 'Zen')
  let group: DrawnFruit[] = []
  for (let elapsed = 0; elapsed < 30_000 && group.length < 3; elapsed += 100) {
    await advance(page, 100)
    group = await page.evaluate(() =>
      window.__browserProbe.fruit
        .filter(
          (item) =>
            item.y > 135 &&
            item.y < innerHeight - Math.max(50, item.radius * 2) &&
            item.x > 50 &&
            item.x < innerWidth - 50,
        )
        .slice(0, 3),
    )
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
  expect(
    await page.evaluate(
      () => window.__browserProbe.impactRings.filter((color) => color === '#fde047').length,
    ),
  ).toBeGreaterThan(0)
  expect(Number(await page.locator('.hud-score strong').innerText())).toBeGreaterThanOrEqual(45)
  // Real WebAudio decoding/playback covers the generated layered WAVs, including
  // the combo chord. Headroom is measured before the user's master gain.
  await expect
    .poll(async () =>
      page.evaluate(() =>
        window.__browserProbe.sfxSamples.some(
          (sample) => Math.abs(sample.duration - 0.248) < 0.001,
        ),
      ),
    )
    .toBe(true)
  const samples = await page.evaluate(() => window.__browserProbe.sfxSamples)
  expect(samples.length).toBeGreaterThanOrEqual(4)
  expect(samples.every((sample) => sample.peak > 0 && sample.peak <= 0.881)).toBe(true)
  expect(samples.every((sample) => sample.rate >= 0.8 && sample.rate <= 1.4)).toBe(true)
  await advance(page, 91_000)
  const results = page.getByRole('dialog', { name: 'Run Complete' })
  const bestStroke = results
    .locator('.result-highlights > div')
    .filter({ has: page.getByText('Best stroke combo', { exact: true }) })
  expect(Number.parseInt(await bestStroke.locator('dd').innerText(), 10)).toBeGreaterThanOrEqual(3)
  await expect(results.locator('.result-highlights')).toContainText('Stroke accuracy100% (1/1)')
})

for (const reducedMotion of [false, true]) {
  test(`bomb impact is readable and expires with reduced motion ${reducedMotion}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await openGame(page, reducedMotion)
    await startMode(page, 'Arcade')
    let bomb: DrawnFruit | undefined
    for (let elapsed = 0; elapsed < 30_000 && !bomb; elapsed += 100) {
      await advance(page, 100)
      bomb = await page.evaluate(() =>
        window.__browserProbe.bombs.find(
          (item) =>
            item.y > 160 && item.y < innerHeight - 50 && item.x > 60 && item.x < innerWidth - 60,
        ),
      )
    }
    expect(
      bomb,
      'The director should offer a visible Arcade bomb after its safe opening',
    ).toBeDefined()
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
    const rings = await page.evaluate(
      () => window.__browserProbe.impactRings.filter((color) => color === '#fb923c').length,
    )
    if (reducedMotion) expect(rings).toBe(0)
    else expect(rings).toBeGreaterThan(0)
    await expect(page.locator('.hud-score strong')).toHaveText(score)
    const timerAfterHit = await page.locator('.hud-timer strong').innerText()
    expect(Number.parseInt(timerAfterHit, 10)).toBeGreaterThanOrEqual(
      Number.parseInt(timer, 10) - 1,
    )
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await advance(page, 800)
    expect(await page.evaluate(() => window.__browserProbe.impactLabels)).toEqual([])
    expect(await page.evaluate(() => window.__browserProbe.impactRings)).toEqual([])
    await expect(page.locator('.hud-timer strong')).toHaveText(timerAfterHit)
  })
}

test('profile traps focus, settings persist, and landscape controls scroll into view', async ({
  page,
}) => {
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
  await profile.getByRole('tab', { name: 'Settings', exact: true }).click()
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

test('profile tabs keep mobile navigation visible and equipment browsing never equips implicitly', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000) // Four viewport layouts plus every profile tab's keyboard sequence.
  await openGame(page)
  const canvas = page.getByLabel('Fruit slicing game canvas', { exact: true })
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height })
    await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
    const profile = page.getByRole('dialog', { name: 'Profile & Rewards', exact: true })
    await expect(profile.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(await profile.evaluate((dialog) => getComputedStyle(dialog).backgroundColor)).toBe(
      'rgb(41, 27, 20)',
    )
    expect(await profile.evaluate((dialog) => getComputedStyle(dialog).boxShadow)).not.toBe('none')
    const fits = await profile.locator('.profile-content').evaluate((content) => ({
      vertical: content.scrollHeight <= content.clientHeight + 1,
      horizontal: content.scrollWidth <= content.clientWidth + 1,
    }))
    expect(fits, `Overview at ${width}×${height}`).toEqual({ vertical: true, horizontal: true })
    const bounds = await profile.boundingBox()
    expect(bounds!.height).toBeLessThanOrEqual(Math.min(480, height - 32))
    expect(await profile.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1)).toBe(
      true,
    )
    await page.screenshot({ path: testInfo.outputPath(`profile-overview-${width}.png`) })
    for (const name of ['Goals', 'Equipment', 'Settings']) {
      await profile.getByRole('tab', { name, exact: true }).click()
      await expect(profile.getByRole('tabpanel')).toHaveCount(1)
      const tabBounds = await profile.boundingBox()
      const navigationBounds = await profile.getByRole('tablist').boundingBox()
      const content = profile.locator('.profile-content')
      await content.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      for (const control of [
        profile.getByRole('button', { name: 'Close', exact: true }),
        ...['Overview', 'Goals', 'Equipment', 'Settings'].map((tab) =>
          profile.getByRole('tab', { name: tab, exact: true }),
        ),
      ]) {
        await expect(control).toBeInViewport()
        const box = await control.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(43.99)
        expect(box!.y).toBeGreaterThanOrEqual(tabBounds!.y)
      }
      expect((await profile.getByRole('tablist').boundingBox())!.y).toBe(navigationBounds!.y)
      expect(
        await content.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true)
      if (name === 'Settings') {
        for (const slider of await profile.getByRole('slider').all()) {
          expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        }
      }
      await page.screenshot({
        path: testInfo.outputPath(`profile-${name.toLowerCase()}-${width}.png`),
      })
    }
    await profile.getByRole('tab', { name: 'Overview', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(profile.getByRole('tab', { name: 'Goals', exact: true })).toBeFocused()
    await expect(profile.getByRole('tab', { name: 'Goals', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await page.keyboard.press('End')
    await expect(profile.getByRole('tab', { name: 'Settings', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(profile.getByRole('tab', { name: 'Overview', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(profile.getByRole('tab', { name: 'Settings', exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(profile.getByRole('tab', { name: 'Overview', exact: true })).toBeFocused()
    for (const tab of ['Overview', 'Goals', 'Equipment', 'Settings']) {
      await profile.getByRole('tab', { name: tab, exact: true }).click()
      await checkDialogKeyboard(page, profile)
    }
    await openGoalCategory(page, 'achievements')
    for (const mode of ['classic', 'arcade', 'zen']) {
      await profile.getByLabel('Achievement mode', { exact: true }).selectOption(mode)
      await expect(
        profile.getByRole('list', { name: 'Achievement progress', exact: true }).locator('li'),
      ).toHaveCount(2)
    }
    await browseEquipment(page, 'Dragon Fang')
    await expect(profile.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
    await expect(
      profile.getByRole('button', { name: 'Equip Dragon Fang', exact: true }),
    ).toBeDisabled()
    await expect(canvas).toHaveAttribute('data-blade', 'bamboo')
    await expect(canvas).toHaveAttribute('data-dojo', 'great-wave')
    expect(
      await page.evaluate(() => localStorage.getItem('saftladen.cosmetics.selection')),
    ).not.toContain('dragon-fang')
    await profile.getByRole('button', { name: 'Close', exact: true }).click()
    await advance(page, 32)
    await expect(page.getByRole('button', { name: 'Profile & Rewards', exact: true })).toBeFocused()
  }
})

test('cosmetic milestones show earned progress and retain automatic unlocks after reload', async ({
  page,
}) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
  const profile = page.getByRole('dialog', { name: 'Profile & Rewards' })
  await expect(
    profile.getByText('Permanent cosmetic unlocks; nothing is spent.', { exact: false }),
  ).toBeVisible()
  const comet = await browseEquipment(page, 'Comet Blade')
  await expect(comet).toContainText('40 Starfruit earned · 0/40 · 40 Starfruit to go')
  const sunset = await browseEquipment(page, 'Sunset Harbor Dojo')
  await expect(sunset).toContainText('Level 3 · 560 XP earned · 0/560 · 560 XP to go')
  await openGoalCategory(page, 'objectives')
  await expect(profile.getByRole('listitem').filter({ hasText: 'Warmup Ritual' })).toContainText(
    'Reward: 80 XP · 10 Starfruit',
  )
  for (const totals of [
    { xp: 559, starfruit: 39 },
    { xp: 560, starfruit: 40 },
    { xp: 1120, starfruit: 110 },
  ]) {
    // Load a previously earned profile through the public persistence boundary.
    await page.evaluate((totals) => {
      const saved = JSON.parse(localStorage.getItem('saftladen.rewards.profile')!)
      localStorage.setItem('saftladen.rewards.profile', JSON.stringify({ ...saved, ...totals }))
    }, totals)
    await page.reload()
    await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
    await browseEquipment(page, 'Comet Blade')
    await expect(comet).toContainText(
      totals.starfruit === 39 ? '39/40 · 1 Starfruit to go' : 'Unlocked · 40 Starfruit earned',
    )
    await browseEquipment(page, 'Sunset Harbor Dojo')
    await expect(sunset).toContainText(
      totals.xp === 559 ? '559/560 · 1 XP to go' : 'Unlocked · Level 3 · 560 XP earned',
    )
    expect(
      await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('saftladen.rewards.profile')!)
        return { xp: saved.xp, starfruit: saved.starfruit }
      }),
    ).toEqual(totals)
  }
  await browseEquipment(page, 'Dragon Fang')
  await expect(profile.getByRole('listitem').filter({ hasText: 'Dragon Fang' })).toContainText(
    'Unlocked · 110 Starfruit earned',
  )
  await browseEquipment(page, 'Storm Temple Dojo')
  await expect(
    profile.getByRole('listitem').filter({ hasText: 'Storm Temple Dojo' }),
  ).toContainText('Unlocked · Level 5 · 1120 XP earned')
  await page.setViewportSize({ width: 844, height: 390 })
  await profile.getByRole('tab', { name: 'Settings', exact: true }).click()
  const volume = profile.getByRole('slider', { name: 'Music', exact: true })
  await volume.scrollIntoViewIfNeeded()
  await expect(volume).toBeInViewport()
})

test('equipment previews, keyboard equip, saved choices and actual gameplay visuals work for every pair', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openGame(page)
  await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
  await browseEquipment(page, 'Comet Blade')
  await expect(page.getByRole('button', { name: 'Equip Comet Blade', exact: true })).toBeDisabled()
  // An unearned or stale saved selection cannot equip a locked reward.
  await page.evaluate(() =>
    localStorage.setItem(
      'saftladen.cosmetics.selection',
      JSON.stringify({
        schemaVersion: 1,
        blade: 'dragon-fang',
        dojo: 'retired-dojo',
      }),
    ),
  )
  await page.reload()
  const canvas = page.getByLabel('Fruit slicing game canvas', { exact: true })
  await expect(canvas).toHaveAttribute('data-blade', 'bamboo')
  await expect(canvas).toHaveAttribute('data-dojo', 'great-wave')
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('saftladen.rewards.profile')!)
    localStorage.setItem(
      'saftladen.rewards.profile',
      JSON.stringify({ ...saved, xp: 1120, starfruit: 110 }),
    )
  })
  await page.reload()
  const backgrounds: string[] = []
  const scores: number[] = []
  for (const pair of [
    {
      blade: 'bamboo',
      bladeName: 'Bamboo Blade',
      dojo: 'great-wave',
      dojoName: 'Great Wave Dojo',
      edge: '#f4ffe6',
      glow: '#8cdb72',
    },
    {
      blade: 'comet',
      bladeName: 'Comet Blade',
      dojo: 'sunset-harbor',
      dojoName: 'Sunset Harbor Dojo',
      edge: '#d9faff',
      glow: '#a78bfa',
    },
    {
      blade: 'dragon-fang',
      bladeName: 'Dragon Fang',
      dojo: 'storm-temple',
      dojoName: 'Storm Temple Dojo',
      edge: '#fff0a6',
      glow: '#ff7858',
    },
  ]) {
    await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
    const profile = page.getByRole('dialog', { name: 'Profile & Rewards' })
    for (const name of [pair.bladeName, pair.dojoName]) {
      const card = await browseEquipment(page, name)
      await expect(card.getByRole('img', { name: new RegExp(`${name} preview:`) })).toHaveCount(1)
      const button = card.getByRole('button')
      await button.scrollIntoViewIfNeeded()
      await expect(button).toBeInViewport()
      const box = await button.boundingBox()
      expect(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= 320).toBe(true)
      const cardBox = await card.boundingBox()
      const panelBox = await profile.boundingBox()
      expect(
        cardBox &&
          panelBox &&
          cardBox.x >= panelBox.x + 8 &&
          cardBox.x + cardBox.width <= panelBox.x + panelBox.width - 8,
      ).toBe(true)
      await button.focus()
      await page.keyboard.press('Enter')
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(profile.getByRole('status')).toHaveText(`${name} equipped.`)
    }
    await page.screenshot({ path: testInfo.outputPath(`equipment-${pair.blade}.png`) })
    await page.keyboard.press('Escape')
    await advance(page, 32)
    await expect(page.getByRole('button', { name: 'Profile & Rewards', exact: true })).toBeFocused()
    await page.reload()
    await expect(canvas).toHaveAttribute('data-blade', pair.blade)
    await expect(canvas).toHaveAttribute('data-dojo', pair.dojo)
    await advance(page, 32)
    // Read actual canvas pixels, rather than trusting the selection attributes.
    backgrounds.push(
      await canvas.evaluate((element: HTMLCanvasElement) => {
        const data = element
          .getContext('2d')!
          .getImageData(Math.floor(element.width / 2), Math.floor(element.height / 2), 1, 1).data
        return Array.from(data).join(',')
      }),
    )
    await startMode(page, 'Zen')
    await swipeVisibleFruit(page)
    scores.push(Number(await page.locator('.hud-score strong').innerText()))
    const colors = await page.evaluate(() => window.__browserProbe.bladeColors)
    expect(colors).toContain(pair.edge)
    expect(colors).toContain(pair.glow)
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click()
    expect(
      await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('saftladen.rewards.profile')!)
        return { xp: saved.xp, starfruit: saved.starfruit }
      }),
    ).toEqual({ xp: 1120, starfruit: 110 })
  }
  expect(new Set(backgrounds).size).toBe(3)
  expect(scores).toEqual([10, 10, 10])
  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
  await browseEquipment(page, 'Dragon Fang')
  const equipped = page.getByRole('button', { name: 'Equipped Dragon Fang', exact: true })
  await equipped.scrollIntoViewIfNeeded()
  await expect(equipped).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('equipment-landscape.png') })
})

test('earned unlocks celebrate once, open equipment and retain selections across runs', async ({
  page,
}) => {
  test.setTimeout(90_000) // Two naturally completed 90-second runs, with every RAF tick rendered.
  await openGame(page, true)
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('saftladen.rewards.profile')!)
    localStorage.setItem(
      'saftladen.rewards.profile',
      JSON.stringify({ ...saved, xp: 559, starfruit: 39 }),
    )
  })
  await page.reload()
  await startMode(page, 'Zen')
  for (
    let attempt = 0;
    attempt < 10 && Number(await page.locator('.hud-score strong').innerText()) < 70;
    attempt++
  ) {
    await swipeVisibleFruit(page)
  }
  expect(Number(await page.locator('.hud-score strong').innerText())).toBeGreaterThanOrEqual(70)
  await advance(page, 91_000)
  const results = page.getByRole('dialog', { name: 'Run Complete' })
  const celebration = results.locator('.result-unlocks')
  await expect(celebration).toContainText('2 new cosmetic unlocks')
  await expect(results.getByRole('status').first()).toContainText(
    'Unlocked Comet Blade, Sunset Harbor Dojo.',
  )
  const settled = await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))
  await results.getByRole('button', { name: 'Choose equipment', exact: true }).click()
  const equipmentProfile = page.getByRole('dialog', { name: 'Profile & Rewards', exact: true })
  await expect(
    equipmentProfile.getByRole('tab', { name: 'Equipment', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await openGoalCategory(page, 'objectives')
  await expect(
    equipmentProfile
      .getByRole('list', { name: 'Objective progress' })
      .getByRole('listitem')
      .filter({ hasText: 'Warmup Ritual' }),
  ).toContainText('1/5')
  for (const name of ['Comet Blade', 'Sunset Harbor Dojo']) {
    const card = await browseEquipment(page, name)
    await card.getByRole('button', { name: `Equip ${name}`, exact: true }).click()
  }
  await equipmentProfile.getByRole('button', { name: 'Close', exact: true }).click()
  await startMode(page, 'Zen')
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-blade', 'comet')
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-dojo', 'sunset-harbor')
  await advance(page, 91_000)
  await expect(results).toBeVisible()
  await expect(celebration).toHaveCount(0)
  // Empty replay settles no additional reward and never repeats old celebrations.
  expect(
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('saftladen.rewards.profile')!)
      return { xp: saved.xp, starfruit: saved.starfruit, totalRuns: saved.totalRuns }
    }),
  ).toEqual(
    ((saved) => ({ xp: saved.xp, starfruit: saved.starfruit, totalRuns: saved.totalRuns }))(
      JSON.parse(settled!),
    ),
  )
  await results.getByRole('button', { name: 'Choose equipment', exact: true }).click()
  const profile = page.getByRole('dialog', { name: 'Profile & Rewards' })
  await expect(profile).toBeVisible()
  await advance(page, 32)
  expect(await profile.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
  await expect(
    profile.getByRole('button', { name: 'Equipped Comet Blade', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
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
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/bomb-*.webp', async (route) => {
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
  await page.unroute('**/bomb-*.webp')
  await page.getByRole('button', { name: 'Retry artwork', exact: true }).click()
  await expect(classic).toBeEnabled()
  await classic.click()
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('simple artwork fallback is an explicit choice after loading fails', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saftladen.onboarding.v1', 'seen'))
  await page.route('**/bomb-*.webp', (route) => route.abort())
  await page.goto('./')
  const classic = page.getByRole('button', { name: 'Classic', exact: true })
  await expect(classic).toBeDisabled()
  await page.getByRole('button', { name: 'Play with simple artwork', exact: true }).click()
  await expect(classic).toBeEnabled()
  await classic.click()
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('Saftladen identity stays readable and controls fit portrait and landscape', async ({
  page,
}, testInfo) => {
  await openGame(page)
  await expect(page.getByRole('heading', { name: 'Saftladen.', exact: true })).toBeVisible()
  const appearance = await page.locator('.mode-guide').evaluate((guide) => {
    const style = getComputedStyle(guide)
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((value) => {
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
      contrast: [
        contrast(style.color),
        contrast(getComputedStyle(guide.querySelector('.slice-guide')!).color),
        contrast(getComputedStyle(guide.querySelector('strong')!).color),
      ],
      font: style.fontFamily,
      buttonFont: getComputedStyle(document.querySelector('.profile-button')!).fontFamily,
    }
  })
  expect(appearance.contrast.every((ratio) => ratio >= 4.5)).toBe(true)
  expect(appearance.buttonFont).toBe(appearance.font)
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await advance(page, 32)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
    const brand = await page.locator('.menu-logo').boundingBox()
    expect(brand && brand.x >= 0 && brand.x + brand.width <= viewport.width).toBe(true)
    for (const name of ['Classic', 'Arcade', 'Zen', 'How to play', 'Profile & Rewards']) {
      const control = page.getByRole('button', { name, exact: true })
      await control.scrollIntoViewIfNeeded()
      const box = await control.boundingBox()
      expect(
        box &&
          box.width >= 44 &&
          box.height >= 44 &&
          box.x >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y >= 0 &&
          box.y + box.height <= viewport.height,
      ).toBe(true)
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

test('first-run practice teaches slicing without changing rewards and remains available later', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openGame(page, false, false)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('saftladen.rewards.profile')))
    .not.toBeNull()
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
  expect(await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))).toBe(
    profileBefore,
  )
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
  expect(await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))).toBe(
    profileBefore,
  )
})

test('short landscape onboarding supports reduced motion, keyboard focus, cancel and skip', async ({
  page,
}) => {
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
  test(`${mode}: countdown cancels and suspends in the background without spending run time`, async ({
    page,
  }) => {
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
    await expect(
      page.getByRole('button', { name: 'Continue countdown', exact: true }),
    ).toBeVisible()
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

test('saved challenge progress rotates from real play and offers a keyboard next-mode action', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 320, height: 568 })
  await openGame(page, true)
  await page.evaluate(() =>
    localStorage.setItem(
      'saftladen.rewards.profile',
      JSON.stringify({
        schemaVersion: 3,
        xp: 1120,
        starfruit: 110,
        totalRuns: 25,
        objectives: ['runs', 'combo', 'score'].map((id) => ({ id, completed: true })),
        achievements: [
          'classic-safe',
          'classic-survival',
          'arcade-score',
          'arcade-stroke',
          'zen-fruit',
          'zen-accuracy',
        ].map((id) => ({ id, completed: true })),
        challenges: {
          cycle: 0,
          expiresAt: '2000-01-01',
          goals: [
            { id: 'harvest-classic', completed: true },
            { id: 'harvest-arcade', completed: true },
            { id: 'harvest-zen', progress: 19 },
          ],
        },
      }),
    ),
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
  const profile = page.getByRole('dialog', { name: 'Profile & Rewards', exact: true })
  await openGoalCategory(page, 'challenges')
  await expect(
    profile.getByRole('region', { name: 'Rotating challenges', exact: true }),
  ).toContainText('No expiry or daily streak')
  await expect(
    profile.getByRole('list', { name: 'Challenge progress', exact: true }),
  ).toContainText('19/20')
  await profile.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Next goal', exact: true })).toContainText(
    'Zen Small Harvest',
  )
  const playZen = page.getByRole('button', { name: 'Play Zen goal', exact: true })
  await playZen.scrollIntoViewIfNeeded()
  const box = await playZen.boundingBox()
  expect(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= 320).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('progression-portrait.png') })
  await playZen.focus()
  await page.keyboard.press('Enter')
  const readyZen = page.getByRole('dialog', { name: 'Ready for Zen?', exact: true })
  await expect(readyZen).toBeVisible()
  await advance(page, 32)
  expect(await readyZen.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
  await swipeVisibleFruit(page)
  await advance(page, 91_000)
  const results = page.getByRole('dialog', { name: 'Run Complete', exact: true })
  await expect(results).toContainText('Goals completed · 1')
  await expect(results).toContainText('A fresh challenge set is ready!')
  await expect(page.getByRole('status')).toContainText('Goals completed: Zen Small Harvest')
  await results.getByRole('button', { name: 'Main Menu', exact: true }).click()
  await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
  await openGoalCategory(page, 'challenges')
  await expect(
    profile.getByRole('list', { name: 'Challenge progress', exact: true }),
  ).toContainText('Zen Back to the Stall')
  await expect(
    profile.getByRole('list', { name: 'Challenge progress', exact: true }).locator('li'),
  ).toHaveCount(3)
  const settled = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('saftladen.rewards.profile')!),
  )
  expect(settled.challenges.cycle).toBe(1)
  expect(settled.challenges.goals.every((goal: { progress: number }) => goal.progress === 0)).toBe(
    true,
  )
  expect(settled.starfruit).toBe(114)
  await profile.getByRole('button', { name: 'Close', exact: true }).click()
  const nextRun = page.getByRole('button', { name: 'Play Zen goal', exact: true })
  await nextRun.focus()
  await page.keyboard.press('Enter')
  await expect(readyZen).toBeVisible()
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
  await openGoalCategory(page, 'challenges')
  await expect(profile).toContainText('Challenge set 2 of 3')
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('saftladen.rewards.profile')!).starfruit,
    ),
  ).toBe(114)
  await profile.getByRole('button', { name: 'Close', exact: true }).click()
  const playClassic = page.getByRole('button', { name: 'Play Classic goal', exact: true })
  await playClassic.scrollIntoViewIfNeeded()
  const landscapeBox = await playClassic.boundingBox()
  expect(landscapeBox && landscapeBox.y >= 0 && landscapeBox.y + landscapeBox.height <= 390).toBe(
    true,
  )
  await page.screenshot({ path: testInfo.outputPath('progression-landscape.png') })
  await playClassic.click()
  const readyClassic = page.getByRole('dialog', { name: 'Ready for Classic?', exact: true })
  await expect(readyClassic).toBeVisible()
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.hud-score')).toHaveCount(0)
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('saftladen.rewards.profile')!)),
  ).toEqual(settled)
})

async function checkDialogKeyboard(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(41, 27, 20)',
  )
  expect(await dialog.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none')
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  const controls = dialog.locator(
    'button:not(:disabled):not([tabindex="-1"]):visible, input:not(:disabled):visible, select:not(:disabled):visible, a[href]:visible, summary:visible, [tabindex="0"]:visible',
  )
  const count = await controls.count()
  expect(count).toBeGreaterThan(0)
  await controls.first().focus()
  await page.keyboard.press('Shift+Tab')
  await expect(controls.last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(controls.first()).toBeFocused()
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < count; i++) {
      await page.keyboard.press(key)
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      )
    }
    await expect(controls.first()).toBeFocused()
  }
  // Native showModal makes controls behind the panel inert, even to DOM focus.
  await page.locator('.music-toggle-button').evaluate((button: HTMLButtonElement) => button.focus())
  await expect(controls.first()).toBeFocused()
}

test('every dialog supports both Tab directions, keyboard transitions and meaningful focus restoration', async ({
  page,
}) => {
  await openGame(page, false, false)
  const zen = page.getByRole('button', { name: 'Zen', exact: true })
  await zen.focus()
  await page.keyboard.press('Space')
  const help = page.getByRole('dialog', { name: 'How to play', exact: true })
  await checkDialogKeyboard(page, help)
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(help).toHaveCount(0)
  await expect(zen).toBeFocused()
  await page.keyboard.press('Enter')
  await help.getByRole('button', { name: 'Skip practice', exact: true }).focus()
  await page.keyboard.press('Enter')
  const ready = page.getByRole('dialog', { name: 'Ready for Zen?', exact: true })
  await checkDialogKeyboard(page, ready)
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(ready).toHaveCount(0)
  await expect(zen).toBeFocused()
  const helpButton = page.getByRole('button', { name: 'How to play', exact: true })
  await helpButton.focus()
  await page.keyboard.press('Enter')
  await checkDialogKeyboard(page, help)
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(helpButton).toBeFocused()
  const profileButton = page.getByRole('button', { name: 'Profile & Rewards', exact: true })
  await profileButton.focus()
  await page.keyboard.press('Enter')
  const profile = page.getByRole('dialog', { name: 'Profile & Rewards', exact: true })
  await checkDialogKeyboard(page, profile)
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(profile).toHaveCount(0)
  await expect(profileButton).toBeFocused()
  await zen.focus()
  await page.keyboard.press('Enter')
  await ready.getByRole('button', { name: 'Start now', exact: true }).focus()
  await page.keyboard.press('Enter')
  await advance(page, 32)
  const pauseButton = page.getByRole('button', { name: 'Pause', exact: true })
  await expect(pauseButton).toBeFocused()
  await page.keyboard.press('Space')
  const paused = page.getByRole('dialog', { name: 'Run Paused', exact: true })
  await checkDialogKeyboard(page, paused)
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(pauseButton).toBeFocused()
  await page.keyboard.press('Enter')
  await paused.getByRole('button', { name: 'Restart', exact: true }).focus()
  await page.keyboard.press('Enter')
  await checkDialogKeyboard(page, ready)
  await ready.getByRole('button', { name: 'Back to menu', exact: true }).focus()
  await page.keyboard.press('Space')
  await advance(page, 32)
  await expect(zen).toBeFocused()
  // A real Classic run ends naturally; no engine state injection.
  await startMode(page, 'Classic')
  await advance(page, 20_000)
  const results = page.getByRole('dialog', { name: 'Run Complete', exact: true })
  await checkDialogKeyboard(page, results)
  await results.getByRole('button', { name: 'Choose equipment', exact: true }).focus()
  await page.keyboard.press('Enter')
  await checkDialogKeyboard(page, profile)
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(profileButton).toBeFocused()
  await startMode(page, 'Classic')
  await advance(page, 20_000)
  await results.getByRole('button', { name: 'Run Again', exact: true }).focus()
  await page.keyboard.press('Space')
  await checkDialogKeyboard(
    page,
    page.getByRole('dialog', { name: 'Ready for Classic?', exact: true }),
  )
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeFocused()
  await startMode(page, 'Classic')
  await advance(page, 20_000)
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(results).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeFocused()
})

test('game shortcuts respect native controls, browser modifiers and held keys', async ({
  page,
}) => {
  await openGame(page)
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.keyboard.press('Control+d')
  await advance(page, 32)
  expect(await page.evaluate(() => window.__browserProbe.debugDrawn)).toBe(false)
  await page.keyboard.down('d')
  await advance(page, 32)
  expect(await page.evaluate(() => window.__browserProbe.debugDrawn)).toBe(true)
  await page.keyboard.down('d') // Sends a native repeated keydown.
  await advance(page, 32)
  expect(await page.evaluate(() => window.__browserProbe.debugDrawn)).toBe(true)
  await page.keyboard.up('d')
  await page.keyboard.press('d')
  await advance(page, 32)
  expect(await page.evaluate(() => window.__browserProbe.debugDrawn)).toBe(false)
  await startMode(page, 'Zen')
  await advance(page, 32)
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.keyboard.press('Control+Space')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const paused = page.getByRole('dialog', { name: 'Run Paused', exact: true })
  await page.keyboard.down('Escape')
  await expect(paused).toBeVisible()
  await page.keyboard.down('Escape')
  await expect(paused).toBeVisible()
  await page.keyboard.up('Escape')
  await expect(paused).toBeVisible()
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await expect(paused).toHaveCount(0)
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.keyboard.down('Space')
  await expect(paused).toBeVisible()
  // Repeated Space must not activate the newly focused Resume button.
  await page.keyboard.down('Space')
  await expect(paused).toBeVisible()
  await page.keyboard.up('Space')
  await expect(paused).toBeVisible()
  // Use a range/checkbox to ensure Space and D cannot resume or toggle debug.
  const music = paused.getByRole('slider', { name: 'Music', exact: true })
  await music.focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Space')
  await page.keyboard.press('d')
  await advance(page, 32)
  await expect(paused).toBeVisible()
  expect(await page.evaluate(() => window.__browserProbe.debugDrawn)).toBe(false)
  const motion = paused.getByRole('checkbox', { name: 'Reduce motion and flashes', exact: true })
  await motion.focus()
  const checked = await motion.isChecked()
  await page.keyboard.press('Space')
  await expect(motion).toBeChecked({ checked: !checked })
  await expect(paused).toBeVisible()
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.keyboard.press('Space')
  await advance(page, 32)
  await expect(paused).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(paused).toBeVisible()
  await paused.getByRole('button', { name: 'Main Menu', exact: true }).focus()
  await page.keyboard.press('Space')
  await advance(page, 32)
  await expect(page.getByRole('button', { name: 'Zen', exact: true })).toBeFocused()
})

test('OS motion defaults and every keyboard setting persist across profile, pause and practice', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openGame(page)
  await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
  const profile = page.getByRole('dialog', { name: 'Profile & Rewards', exact: true })
  await profile.getByRole('tab', { name: 'Settings', exact: true }).click()
  const motion = profile.getByRole('checkbox', { name: 'Reduce motion and flashes', exact: true })
  await expect(motion).toBeChecked()
  await expect(motion).toHaveAccessibleDescription(
    'Hides flashes, bursts and particles. Score and bomb messages stay visible.',
  )
  for (const name of ['Music', 'SFX']) {
    const slider = profile.getByRole('slider', { name, exact: true })
    await slider.focus()
    await page.keyboard.press('Home')
    await expect(slider).toHaveValue('0')
    await expect(slider).toHaveAttribute('aria-valuetext', '0 percent')
  }
  const sensitivity = profile.getByRole('slider', { name: 'Blade sensitivity', exact: true })
  await sensitivity.focus()
  await page.keyboard.press('Home')
  await expect(sensitivity).toHaveValue('0.5')
  await expect(sensitivity).toHaveAttribute('aria-valuetext', '50 percent')
  await motion.focus()
  await page.keyboard.press('Space')
  await expect(motion).not.toBeChecked()
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  await expect(page.locator('main')).toHaveAttribute('data-reduced-motion', 'false')
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  async function slowPracticeSwipe() {
    const rect = await page.getByLabel('Practice slicing canvas', { exact: true }).boundingBox()
    if (!rect) throw new Error('Practice canvas missing')
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
    await page.mouse.down()
    await advance(page, 100)
    await page.mouse.move(rect.x + rect.width / 2 + 10, rect.y + rect.height / 2)
    await page.mouse.up()
  }
  await slowPracticeSwipe()
  await expect(page.locator('.practice-feedback')).toHaveText('Try again: swipe across the apple.')
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await startMode(page, 'Zen')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const paused = page.getByRole('dialog', { name: 'Run Paused', exact: true })
  for (const name of ['Music', 'SFX'])
    await expect(paused.getByRole('slider', { name, exact: true })).toHaveValue('0')
  const pauseSensitivity = paused.getByRole('slider', { name: 'Blade sensitivity', exact: true })
  await expect(pauseSensitivity).toHaveValue('0.5')
  await pauseSensitivity.focus()
  await page.keyboard.press('End')
  await expect(pauseSensitivity).toHaveAttribute('aria-valuetext', '200 percent')
  await paused.getByRole('button', { name: 'Main Menu', exact: true }).click()
  await advance(page, 32)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Profile & Rewards', exact: true }).click()
  await profile.getByRole('tab', { name: 'Settings', exact: true }).click()
  await expect(sensitivity).toHaveValue('2')
  await expect(motion).not.toBeChecked()
  await page.keyboard.press('Escape')
  await advance(page, 32)
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await slowPracticeSwipe()
  await expect(page.locator('.practice-feedback')).toHaveText('Nice slice! Ready for the game.')
})
