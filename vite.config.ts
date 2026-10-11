import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import path from 'path';

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'TrailWhistle — Offline Bird Call Identifier',
        short_name: 'TrailWhistle',
        description: 'Instant on-device bird audio recognition with zero cell service or cloud APIs required.',
        theme_color: '#1f3927',
        background_color: '#0d1f14',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,mjs,txt}'],
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'birdnet-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/cdn-lfs\.huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'birdnet-lfs-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 90,
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
  // Vitest test configuration
  // @ts-ignore
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(process.cwd(), 'src/test/setup.ts')],
  },
});
