import { expect, test, type Page } from '@playwright/test'

async function stubHomepageApis(page: Page) {
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
          title: 'Bohemian Rhapsody',
          artist: 'Queen',
          spotifyUrl: 'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
        },
      }),
    }),
  )
}

test('homepage loads and its main controls work', async ({ page }) => {
  await stubHomepageApis(page)

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Kritiraj (Kenny)' })).toBeVisible()
  await expect(page.getByText('Software Engineer', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Bohemian Rhapsody by Queen' })).toHaveAttribute(
    'href',
    'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
  )
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  const workbench = page.getByText('WorkBench', { exact: true }).first()
  await workbench.scrollIntoViewIfNeeded()
  await expect(workbench).toBeVisible()

  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.getByRole('button', { name: 'List view' }).click()
  await expect(page.locator('#projects .flex.flex-col.divide-y')).toBeVisible()
})

test('calendar has one tab stop and supports keyboard navigation and selection', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00Z'))
  await stubHomepageApis(page)
  await page.goto('/')

  const cells = page.locator('[role="grid"] button[data-date]')
  // 2026 runs Jan 1 (a Thursday) to Dec 31 (also a Thursday); the leading Mon to Wed of 2025 are hidden,
  // and so is every day after today (Thu Oct 1), though the grid keeps the whole year's columns
  const first = page.locator('[data-date="2026-01-01"]')
  const today = page.locator('[data-date="2026-10-01"]')
  const latest = today
  const tabStop = page.locator('[role="grid"] button[tabindex="0"]')
  const grid = page.getByRole('grid', { name: 'contributions calendar' })
  await expect(grid).toHaveAttribute('aria-rowcount', '7')
  await expect(grid).toHaveAttribute('aria-colcount', '53')
  await expect(grid.getByRole('row')).toHaveCount(7)
  await expect(grid.getByRole('gridcell')).toHaveCount(await cells.count())
  await expect(grid.getByRole('row').nth(3)).toHaveAttribute('aria-rowindex', '4')
  await expect(grid.getByRole('row').nth(3).getByRole('gridcell')).toHaveCount(40)
  await expect(grid.getByRole('row').nth(6).getByRole('gridcell')).toHaveCount(39)
  await expect(latest.locator('..')).toHaveAttribute('aria-colindex', '40')
  for (const future of ['2026-10-02', '2026-10-05', '2026-12-31']) {
    // future days show as inert squares: no button, no tab stop, hidden from assistive tech
    await expect(page.locator(`[data-date="${future}"]`)).toHaveCount(0)
    await expect(page.locator(`[data-disabled="${future}"]`)).toHaveAttribute('aria-hidden', 'true')
  }
  // days outside the year are blank: neither buttons nor disabled squares
  for (const outside of ['2025-12-29', '2025-12-30', '2025-12-31', '2027-01-01']) {
    await expect(page.locator(`[data-date="${outside}"], [data-disabled="${outside}"]`)).toHaveCount(0)
  }
  await expect(grid.getByText('Jan', { exact: true })).toBeVisible()
  await expect(page.getByText('Jan 1 – Oct 1')).toBeVisible()
  await expect(tabStop).toHaveCount(1)
  await expect(today).toHaveAttribute('tabindex', '0')
  // the year picker is the stop before the grid
  await page.getByRole('button', { name: 'Show 2026 activity' }).focus()
  await page.keyboard.press('Tab')
  await expect(today).toBeFocused()

  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  await page.keyboard.press('End')
  await expect(latest).toBeFocused()
  await page.keyboard.press('Control+Home')
  await expect(first).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowLeft')
  await expect(first).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-date="2026-01-02"]')).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('[data-date="2026-01-02"]')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const selected = page.locator('[data-date="2026-01-09"]')
  await expect(selected).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(selected).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowUp')
  await expect(first).toBeFocused()
  await page.keyboard.press('Space')
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  // ArrowLeft from week 1 stays on its row when that weekday is hidden in week 0
  await page.locator('[data-date="2026-01-05"]').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('[data-date="2026-01-05"]')).toBeFocused()
  await first.focus()
  await page.keyboard.press('End')
  await expect(latest).toBeFocused()
  await page.keyboard.press('Control+End')
  await expect(latest).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(latest).toBeFocused()
  await expect(tabStop).toHaveCount(1)
  await page.keyboard.press('Tab')
  await expect(page.locator('[role="grid"] button:focus')).toHaveCount(0)
  await page.keyboard.press('Shift+Tab')
  await expect(latest).toBeFocused()
})

test('calendar shows one calendar year at a time, starting from 2026', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-02-10T12:00:00Z'))
  const years: string[] = []
  await stubHomepageApis(page)
  await page.route('https://github-contributions-api.jogruber.de/**', (route) => {
    const year = new URL(route.request().url()).searchParams.get('y') ?? ''
    years.push(year)
    return route.fulfill({
      json: { contributions: [{ date: `${year}-01-05`, count: 3, level: 2 }] },
    })
  })
  await page.goto('/')

  const picker = page.getByRole('group', { name: 'Contribution year' })
  await expect(picker.getByRole('button')).toHaveText(['2026', '2027'])
  await expect(page.getByRole('button', { name: 'Show 2027 activity' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Jan 1 – Feb 10')).toBeVisible()
  await expect(page.getByRole('button', { name: '3 contributions on Tue, Jan 5' })).toBeVisible()
  expect(years).toEqual(['2027'])

  await page.getByRole('button', { name: 'Show 2026 activity' }).click()
  await expect(page.getByRole('button', { name: 'Show 2026 activity' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '3 contributions on Mon, Jan 5' })).toBeVisible()
  await expect(page.getByText('Jan 1 – Dec 31')).toBeVisible()
  expect(years).toEqual(['2027', '2026'])

  await page.getByRole('button', { name: 'Show 2027 activity' }).click()
  await expect(page.getByRole('button', { name: '3 contributions on Tue, Jan 5' })).toBeVisible()
  expect(years).toEqual(['2027', '2026'])
})

test('production assets load and the page survives an optional banner chunk failure', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await stubHomepageApis(page)
  let bannerBlocked = false
  await page.route(/\/assets\/profile-banner-.*\.js$/, (route) => {
    bannerBlocked = true
    return route.abort()
  })
  await page.goto('/')
  await expect(page.locator('script[type="module"]')).toHaveAttribute('src', /^\/assets\/.*\.js$/)
  await expect(page.getByRole('button', { name: /Show next Spotify example/ })).toHaveCount(0)
  const profile = page.getByRole('img', { name: "Kritiraj's profile picture" })
  await expect.poll(() => profile.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(448)
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.png')
  await expect.poll(() => bannerBlocked).toBe(true)
  await expect(page.getByRole('heading', { name: 'Kritiraj (Kenny)' })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
})
