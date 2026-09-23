import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('tooltips appear on hover and stay hidden after touch taps', async ({ browser }, testInfo) => {
  const videoDirectory = testInfo.outputPath('tooltip-demo')
  await mkdir(videoDirectory, { recursive: true })

  const desktopContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 1000 } },
  })
  const desktopPage = await desktopContext.newPage()
  await desktopPage.route('https://github-contributions-api.jogruber.de/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contributions: [] }) }),
  )
  await desktopPage.route('https://counterapi.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 42 }) }),
  )
  await desktopPage.route('**/api/now-playing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'idle', track: null }) }),
  )
  await desktopPage.goto('/')

  const desktopToggle = desktopPage.getByRole('button', { name: 'Switch to dark mode' })
  const desktopTooltip = desktopPage.locator('[role="tooltip"]').filter({ hasText: 'Switch to dark mode' })
  await desktopToggle.hover()
  await expect(desktopTooltip).toHaveCSS('opacity', '1')
  await desktopPage.mouse.move(10, 10)
  await expect(desktopTooltip).toHaveCSS('opacity', '0')

  const desktopVideo = desktopPage.video()
  await desktopContext.close()

  const touchContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
    recordVideo: { dir: videoDirectory, size: { width: 390, height: 844 } },
  })
  const touchPage = await touchContext.newPage()
  await touchPage.addInitScript(() => window.localStorage.setItem('theme', 'light'))
  await touchPage.route('https://github-contributions-api.jogruber.de/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contributions: [] }) }),
  )
  await touchPage.route('https://counterapi.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 42 }) }),
  )
  await touchPage.route('**/api/now-playing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'idle', track: null }) }),
  )
  await touchPage.goto('/')

  const touchToggle = touchPage.getByRole('button', { name: 'Switch to dark mode' })
  await touchToggle.tap()
  await expect(touchPage.locator('html')).toHaveClass(/dark/)
  await touchPage.waitForTimeout(250)
  const touchTooltip = touchPage.locator('[role="tooltip"]').filter({ hasText: 'Switch to light mode' })
  await expect(touchTooltip).toHaveCSS('opacity', '0')

  const touchVideo = touchPage.video()
  await touchContext.close()

  if (desktopVideo) {
    await testInfo.attach('desktop-hover.webm', { path: await desktopVideo.path(), contentType: 'video/webm' })
  }
  if (touchVideo) {
    await testInfo.attach('touch-tap-no-tooltip.webm', { path: await touchVideo.path(), contentType: 'video/webm' })
  }
})
