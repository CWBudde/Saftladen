import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      includeAssets: ['favicon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'manifest.webmanifest'],
      workbox: {
        // Keep the message handler available synchronously when a stopped worker
        // wakes up; updates must not race a separate runtime loader.
        inlineWorkboxRuntime: true,
        skipWaiting: false,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,webmanifest,wav}'],
        globIgnores: ['**/splash-screen.png'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/music-[^/]+\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'saftladen-music',
              expiration: { maxEntries: 2, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
        ],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  base: process.env.NODE_ENV === 'production' ? '/Saftladen/' : '/',
})
