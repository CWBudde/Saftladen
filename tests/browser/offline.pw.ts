import { expect, test as base } from '@playwright/test'
import type { Page, APIRequestContext } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createDefaultRewardProfile } from '../../src/game/ui/rewards'

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await use(errors)
    expect(errors, 'Uncaught browser exceptions').toEqual([])
  }, { auto: true }],
})

test.use({ baseURL: 'http://127.0.0.1:4175/Saftladen/', serviceWorkers: 'allow' })

async function configure(request: APIRequestContext, release = 0, fail = '') {
  const response = await request.post(`http://127.0.0.1:4175/__test/config?release=${release}&fail=${encodeURIComponent(fail)}`)
  expect(response.status()).toBe(204)
}

async function open(page: Page) {
  await page.addInitScript(profile => {
    if (!localStorage.getItem('saftladen.rewards.profile')) {
      localStorage.setItem('saftladen.rewards.profile', JSON.stringify(profile))
    }
    localStorage.setItem('saftladen.onboarding.v1', 'seen')
    localStorage.setItem('saftladen.ui.settings', JSON.stringify({
      schemaVersion: 1, musicVolume: 0, sfxVolume: 0, sliceSensitivity: 1, reducedMotion: true,
    }))
  }, { ...createDefaultRewardProfile(), xp: 1000, starfruit: 80 })
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
}

async function installed(page: Page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
}

async function checkUpdate(page: Page) {
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update() })
}

async function precacheFailed(request: APIRequestContext) {
  await expect.poll(async () => {
    const response = await request.get('http://127.0.0.1:4175/__test/status')
    return (await response.json() as { failedPrecacheDownloads: number }).failedPrecacheDownloads
  }, { message: 'The real worker must attempt and fail its precache download' }).toBeGreaterThan(0)
}

test.beforeEach(async ({ request }) => { await configure(request) })
test.afterEach(async ({ request }) => { await configure(request) })

test('installed game reloads offline with every gameplay image decoded', async ({ page, context }) => {
  await open(page)
  await installed(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  await expect(page.getByText('Simple artwork enabled', { exact: false })).toHaveCount(0)
  const source = await readFile('dist/sw.js', 'utf8')
  const images = [...source.matchAll(/url:"(assets\/[^"?]+\.(?:png|jpg))"/g)].map(match => match[1])
  expect(images).toHaveLength(18)
  const decoded = await page.evaluate(async urls => {
    return Promise.all(urls.map(async url => {
      const image = new Image()
      image.src = new URL(url, location.href).href
      await image.decode()
      return image.naturalWidth > 0 && image.naturalHeight > 0
    }))
  }, images)
  expect(decoded.every(Boolean)).toBe(true)
  await page.getByRole('button', { name: 'Zen', exact: true }).click()
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('interrupted first install recovers artwork and completes offline installation', async ({ page, request, context }) => {
  await configure(request, 0, 'apple1-')
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Retry artwork' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeDisabled()
  await precacheFailed(request)
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return !registration || (!registration.installing && !registration.active)
  })).toBe(true)
  await configure(request)
  await page.getByRole('button', { name: 'Retry artwork' }).click()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  // Reconnection is a public browser lifecycle event, not a game test hook.
  await context.setOffline(true)
  await context.setOffline(false)
  await installed(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
})

test('failed update keeps the old cache usable offline then retries successfully', async ({ page, request, context }) => {
  await open(page)
  await installed(page)
  await configure(request, 1, 'index.html')
  await checkUpdate(page)
  await precacheFailed(request)
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return !registration?.installing && !registration?.waiting
  })).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Classic', exact: true })).toBeEnabled()
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '0')
  await configure(request, 1)
  await context.setOffline(false)
  await checkUpdate(page)
  await expect(page.getByRole('button', { name: 'Update game' })).toBeVisible()
  const navigation = page.waitForEvent('load', { timeout: 20_000 }).catch(async error => {
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return { active: registration?.active?.state, waiting: registration?.waiting?.state,
        installing: registration?.installing?.state }
    })
    throw new Error(`${String(error)}; Worker state: ${JSON.stringify(state)}`)
  })
  await page.getByRole('button', { name: 'Update game' }).click()
  await navigation
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '1')
})

test('update accepted in another tab preserves running and paused games and saved progress', async ({ page, context, request }) => {
  await open(page)
  await installed(page)
  await page.evaluate(() => localStorage.setItem('saftladen.cosmetics.selection', JSON.stringify({
    schemaVersion: 1, blade: 'comet', dojo: 'sunset-harbor',
  })))
  const saved = await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))
  expect(saved).not.toBeNull()
  let navigations = 0
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1 })
  await page.getByRole('button', { name: 'Zen', exact: true }).click()
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
  await configure(request, 2)
  await checkUpdate(page)
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true)
  await expect(page.getByRole('button', { name: 'Update game' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Run Paused' })).toBeVisible()
  const second = await context.newPage()
  await open(second)
  const navigation = second.waitForEvent('load')
  await second.getByRole('button', { name: 'Update game' }).click()
  await navigation
  await expect(second.locator('meta[name="test-release"]')).toHaveAttribute('content', '2')
  await expect(page.getByRole('dialog', { name: 'Run Paused' })).toBeVisible()
  expect(navigations).toBe(0)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  expect(navigations).toBe(0)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Update game' })).toBeVisible()
  expect(navigations).toBe(0)
  const reload = page.waitForEvent('load')
  await page.getByRole('button', { name: 'Update game' }).click()
  await reload
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '2')
  expect(await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))).toBe(saved)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('saftladen.cosmetics.selection') ?? '{}')))
    .toEqual({ schemaVersion: 1, blade: 'comet', dojo: 'sunset-harbor' })
})

test('waiting update survives countdown and a complete run until accepted from results', async ({ page, request }) => {
  await open(page)
  await installed(page)
  await configure(request, 3)
  await checkUpdate(page)
  await expect(page.getByRole('button', { name: 'Update game' })).toBeVisible()
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'))
  await page.getByRole('button', { name: 'Zen', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Ready for Zen?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update game' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Start now', exact: true }).click()
  await page.clock.runFor(90_100)
  await expect(page.getByRole('dialog', { name: 'Run Complete' })).toBeVisible()
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '0')
  const saved = await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))
  const navigation = page.waitForEvent('load')
  await page.getByRole('button', { name: 'Update game' }).click()
  await navigation
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '3')
  expect(await page.evaluate(() => localStorage.getItem('saftladen.rewards.profile'))).toBe(saved)
})
