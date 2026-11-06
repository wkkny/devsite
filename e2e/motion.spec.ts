import { expect, test } from '@playwright/test'

// The rest of the suite runs with reduced motion; these check the full-motion paths.
test.use({ reducedMotion: 'no-preference' })

test.beforeEach(async ({ page }) => {
  await page.route('https://github-contributions-api.jogruber.de/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contributions: [] }) }),
  )
  await page.route('**/api/visitors', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 42 }) }),
  )
  await page.route('**/api/now-playing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'idle', track: null }) }),
  )
})

test('section headings slide up into view and settle', async ({ page }) => {
  await page.goto('/')
  for (const id of ['activity-heading', 'projects-heading']) {
    const heading = page.locator(`#${id}`)
    await heading.scrollIntoViewIfNeeded()
    // the text starts clipped below its line; once revealed it rests with no offset
    await expect
      .poll(() => heading.evaluate((element) => getComputedStyle(element.querySelector('span span')!).transform))
      .toBe('none')
  }
})

test('the theme wave plays through instead of jumping to the end', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.waitForTimeout(120)
  const wave = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => (animation.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)')
      .map((animation) => ({ state: animation.playState, time: Number(animation.currentTime) })),
  )
  // the clip is mid-sweep, not already finished
  expect(wave.some(({ state, time }) => state !== 'finished' && time > 0 && time < 600)).toBe(true)
  await expect(page.locator('html')).toHaveClass(/dark/)
})
