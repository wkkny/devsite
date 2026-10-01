import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // The heavier specs (clock-driven polling, aborted chunk loads) time out
  // under CPU contention from parallel workers, so serialize on CI.
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: 'bun run build && bun run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
