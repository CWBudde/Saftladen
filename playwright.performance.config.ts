import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser/performance',
  testMatch: 'renderer.profile.ts',
  workers: 1,
  timeout: 180_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', serviceWorkers: 'block' },
  webServer: {
    command:
      'bun --bun vite preview --outDir output/performance --base / --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/tests/browser/performance/index.html',
    reuseExistingServer: false,
  },
})
