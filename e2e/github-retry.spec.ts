import { expect, test } from '@playwright/test'

test('GitHub activity retries only on request and clears loading and errors after success', async ({ page }) => {
  let requests = 0
  let finishRetry: (() => void) | undefined
  await page.route('https://github-contributions-api.jogruber.de/**', async (route) => {
    requests += 1
    if (requests === 1) return route.fulfill({ status: 503, body: '{}' })
    await new Promise<void>((resolve) => { finishRetry = resolve })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contributions: [] }) })
  })
  await page.route('https://counterapi.com/**', (route) => route.fulfill({ json: { value: 42 } }))
  await page.route('**/api/now-playing', (route) => route.fulfill({ json: { status: 'idle', track: null } }))
  await page.goto('/')
  const retry = page.getByRole('button', { name: 'Retry GitHub activity' })
  await expect(retry).toBeVisible()
  await page.clock.install()
  await page.clock.runFor(30_000)
  expect(requests).toBe(1)
  await retry.click()
  await expect(page.getByText('Loading GitHub activity…')).toBeVisible()
  await expect(retry).toHaveAttribute('aria-disabled', 'true')
  await expect.poll(() => requests).toBe(2)
  finishRetry?.()
  await expect(page.getByText('Loading GitHub activity…')).toHaveCount(0)
  await expect(page.getByText('GitHub activity is unavailable right now.', { exact: false })).toHaveCount(0)
})

for (const moveFocusAway of [false, true]) {
  test(`keyboard retry preserves focus (move away: ${moveFocusAway})`, async ({ page }) => {
    let requests = 0
    let finishRequest: (() => void) | undefined
    await page.route('https://github-contributions-api.jogruber.de/**', async (route) => {
      const request = ++requests
      if (request > 1) await new Promise<void>((resolve) => { finishRequest = resolve })
      return request < 3
        ? route.fulfill({ status: 503, body: '{}' })
        : route.fulfill({ json: { contributions: [] } })
    })
    await page.route('https://counterapi.com/**', (route) => route.fulfill({ json: { value: 42 } }))
    await page.route('**/api/now-playing', (route) => route.fulfill({ json: { status: 'idle', track: null } }))
    await page.goto('/')

    const retry = page.getByRole('button', { name: 'Retry GitHub activity' })
    await expect(retry).toBeVisible()
    await retry.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Loading GitHub activity…')).toBeVisible()
    await expect(retry).toBeFocused()
    await expect(retry).toHaveAttribute('aria-disabled', 'true')
    await expect.poll(() => requests).toBe(2)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    expect(requests).toBe(2)

    finishRequest?.()
    await expect(retry).toHaveAttribute('aria-disabled', 'false')
    await expect(retry).toBeFocused()
    await page.keyboard.press('Space')
    await expect.poll(() => requests).toBe(3)
    await expect(retry).toBeFocused()
    const otherControl = page.getByRole('button', { name: 'List view' })
    if (moveFocusAway) await otherControl.focus()
    finishRequest?.()
    await expect(retry).toHaveCount(0)
    if (moveFocusAway) {
      await expect(otherControl).toBeFocused()
    } else {
      await expect(page.locator('#github-activity [role="grid"] button[tabindex="0"]')).toBeFocused()
    }
  })
}

test('a GitHub request that never answers times out and offers a retry', async ({ page }) => {
  await page.clock.install()
  await page.route('https://github-contributions-api.jogruber.de/**', () => new Promise<void>(() => {}))
  await page.route('https://counterapi.com/**', (route) => route.fulfill({ json: { value: 42 } }))
  await page.route('**/api/now-playing', (route) => route.fulfill({ json: { status: 'idle', track: null } }))
  await page.goto('/')
  await expect(page.getByText('Loading GitHub activity…')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry GitHub activity' })).toHaveCount(0)
  await page.clock.runFor(10_000)
  await expect(page.getByText('GitHub activity is unavailable right now.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry GitHub activity' })).toBeVisible()
})

test('a retry in one year does not show Retry on the first load of another year', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-02-10T12:00:00Z'))
  const requests: string[] = []
  await page.route('https://github-contributions-api.jogruber.de/**', async (route) => {
    const year = new URL(route.request().url()).searchParams.get('y') ?? ''
    requests.push(year)
    if (year === '2027' && requests.length === 1) return route.fulfill({ status: 503, body: '{}' })
    // 2026 never answers, so its first load stays visible
    if (year === '2026') return new Promise<void>(() => {})
    return route.fulfill({ json: { contributions: [] } })
  })
  await page.route('https://counterapi.com/**', (route) => route.fulfill({ json: { value: 42 } }))
  await page.route('**/api/now-playing', (route) => route.fulfill({ json: { status: 'idle', track: null } }))
  await page.goto('/')

  const retry = page.getByRole('button', { name: 'Retry GitHub activity' })
  await retry.click()
  await expect(retry).toHaveCount(0)
  await page.getByRole('button', { name: 'Show 2026 activity' }).click()
  await expect(page.getByText('Loading GitHub activity…')).toBeVisible()
  await expect(retry).toHaveCount(0)
})

test('reduced-motion project status is static ordinary text', async ({ page }) => {
  await page.route('https://github-contributions-api.jogruber.de/**', (route) => route.fulfill({ json: { contributions: [] } }))
  await page.route('https://counterapi.com/**', (route) => route.fulfill({ json: { value: 42 } }))
  await page.route('**/api/now-playing', (route) => route.fulfill({ json: { status: 'idle', track: null } }))
  await page.goto('/')
  const status = page.locator('.project-status')
  await expect(status).toHaveText('Cooking up fresh projects.')
  await expect(status).not.toHaveAttribute('aria-live')
  await page.clock.install()
  await page.clock.runFor(20_000)
  await expect(status).toHaveText('Cooking up fresh projects.')
})
