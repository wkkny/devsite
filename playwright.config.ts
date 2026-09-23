import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: 'bun run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    env: { VITE_SPOTIFY_USE_MOCK: 'false' },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
