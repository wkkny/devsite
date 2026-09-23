import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'no-preference',
})

test('theme toggles on touch and long Spotify titles truncate', async ({ page }) => {
  const trackTitle = 'A Very Long Song Title That Should Be Truncated on a Narrow Mobile Screen'
  await page.addInitScript(() => window.localStorage.setItem('theme', 'light'))
  await page.route('https://github-contributions-api.jogruber.de/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ contributions: [] }),
    }),
  )
  await page.route('https://counterapi.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: 42 }),
    }),
  )
  await page.route('**/api/now-playing', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'playing',
        track: {
          title: trackTitle,
          artist: 'A Mobile Test Artist',
          spotifyUrl: 'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
        },
      }),
    }),
  )

  await page.goto('/')
  const themeToggle = page.getByRole('button', { name: 'Switch to dark mode' })
  await themeToggle.tap()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('theme'))).toBe('dark')

  const title = page.locator('a[href="https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv"] .truncate')
  await expect(title).toHaveText(trackTitle)
  const titleLayout = await title.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    }
  })
  expect(titleLayout.textOverflow).toBe('ellipsis')
  expect(titleLayout.whiteSpace).toBe('nowrap')
  expect(titleLayout.scrollWidth).toBeGreaterThan(titleLayout.clientWidth)
  await expect(page.locator('a[href="https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv"] .whitespace-nowrap'))
    .toHaveText('by A Mobile Test Artist')
})
