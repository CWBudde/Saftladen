import { build } from 'vite'

// Separate production bundle: never ship the synthetic profiling fixture.
await build({
  configFile: false,
  base: '/',
  publicDir: false,
  build: {
    outDir: 'output/performance',
    emptyOutDir: true,
    rollupOptions: { input: 'tests/browser/performance/index.html' },
  },
})
