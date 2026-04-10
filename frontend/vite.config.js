import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    env: {
      VITE_API_URL: 'http://127.0.0.1:9',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx'],
    },
    alias: {
      'virtual:pwa-register/react': resolve(__dirname, 'tests/mocks/pwa-register-react.js'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      /** User confirms via PwaUpdatePrompt so new precache (HTML/JS/help) loads. */
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'MountyHall App',
        short_name: 'MountyHall',
        description: 'MountyHall Companion App',
        /** Align with index.html theme-color for install UI / splash */
        theme_color: '#667eea',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        /**
         * Prefer network for navigations when online so index.html is not stuck on a stale
         * precache entry; falls back to cache when offline.
         */
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mh-pages',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    host: true
  }
})
