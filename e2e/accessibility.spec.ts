import { expect, test, type Page } from '@playwright/test'

async function stubApis(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00Z'))
  await page.route('https://github-contributions-api.jogruber.de/**', (route) => route.fulfill({
    json: { contributions: [{ date: '2026-01-01', count: 3, level: 2 }, { date: '2026-01-02', count: 2, level: 1 }] },
  }))
  await page.route('https://counterapi.com/**', (route) => route.fulfill({ json: { value: 42 } }))
  await page.route('**/api/now-playing', (route) => route.fulfill({ json: {
    status: 'playing', track: { title: 'Test song', artist: 'Test artist', spotifyUrl: 'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv' },
  } }))
  await page.goto('/')
}

test('Base UI tooltips preserve trigger names and dismiss with Escape', async ({ page }) => {
  await stubApis(page)
  for (const [name, label] of [['GitHub', 'Visit GitHub profile'], ['Test song by Test artist', 'Open in Spotify']]) {
    const link = page.getByRole('link', { name, exact: true })
    await expect(link).toHaveAccessibleName(name)
    await link.focus()
    const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: label })
    await expect(tooltip).toBeVisible()
    await expect(link).toHaveAccessibleName(name)
    await expect(link).not.toHaveAttribute('aria-describedby')
    await expect(tooltip).toHaveAttribute('aria-hidden', 'true')
    await page.keyboard.press('Escape')
    await expect(tooltip).toHaveCount(0)
    await expect(link).toBeFocused()
  }
  await expect(page.getByRole('link', { name: 'WorkBench on GitHub' })).toHaveAttribute('href', /WorkBench$/)
  await expect(page.getByRole('link', { name: 'DigiLicense on GitHub' })).toHaveAttribute('href', /DigiLicense$/)
})

test('calendar announces range totals and Escape clears from the legend', async ({ page }) => {
  await stubApis(page)
  const first = page.locator('[data-date="2026-01-01"]')
  await expect(first).toHaveAccessibleName('3 contributions on Thu, Jan 1')
  await first.focus()
  await page.keyboard.press('Space')
  const status = page.locator('#github-activity [role="status"]').filter({ hasText: 'selected' })
  await expect(status).toContainText('Select a second day')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('#github-activity [role="status"]')).toHaveText('5 contributions from Thu, Jan 1 to Fri, Jan 2, 2 days.')
  const legend = page.getByRole('button', { name: 'Show only level 4 days' })
  await legend.focus()
  await page.keyboard.press('Space')
  await expect(legend).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(legend).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0)
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#github-activity [role="status"]')).toHaveText('Selection cleared.')

  await first.focus()
  // Level 4 dims all the data in this fixture; keyboard focus must remain fully visible.
  await legend.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('Shift+Tab')
  await first.focus()
  await expect(first).toHaveCSS('opacity', '1')
  await expect(first).toHaveCSS('outline-style', 'solid')
  await expect(first).toHaveCSS('outline-width', '2px')
})

test('calendar pointer readout is hoverable and dismissible without moving focus', async ({ page }) => {
  await stubApis(page)
  const first = page.locator('[data-date="2026-01-01"]')
  await first.hover()
  const tooltip = page.locator('[role="tooltip"][data-open]')
  await expect(tooltip).toBeVisible()
  await tooltip.hover()
  await expect(tooltip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)
})

test('theme transition retains keyboard focus and reduced motion skips project transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await stubApis(page)
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light')
    document.documentElement.classList.remove('dark')
  })
  await page.reload()
  const toggle = page.getByRole('button', { name: 'Switch to dark mode' })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[aria-label="Switch to light mode"]')).toBeFocused()
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toHaveAttribute('aria-disabled', 'false')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => {
    document.startViewTransition = () => { throw new Error('Reduced motion must skip view transitions') }
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('button', { name: 'List view' }).click()
  await expect(page.locator('#projects .flex.flex-col.divide-y')).toBeVisible()
  expect(errors).toEqual([])
})

test('small project labels and blue link text meet text contrast in both themes', async ({ page }) => {
  await stubApis(page)
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value === 'dark'), theme)
    const link = page.getByRole('link', { name: 'All repositories' })
    await link.hover()
    // Wait for the hover color transition before measuring the rendered color.
    await expect(link).toHaveCSS('color', theme === 'light' ? 'rgb(0, 116, 199)' : 'rgb(0, 149, 255)')
    for (const text of [link, page.getByRole('list', { name: 'WorkBench technologies' }).getByText('Electron')]) {
      const ratio = await text.evaluate((element) => {
        const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number)
        const luminance = (color: number[]) => color.map((channel) => {
          const value = channel / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0)
        const foreground = luminance(rgb(getComputedStyle(element).color))
        const card = element.closest('[data-slot="card"]')
        const background = luminance(rgb(getComputedStyle(card ?? document.body).backgroundColor))
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      })
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
  }
})
