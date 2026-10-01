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
  await expect(retry).toHaveCount(0)
  await expect.poll(() => requests).toBe(2)
  finishRetry?.()
  await expect(page.getByText('Loading GitHub activity…')).toHaveCount(0)
  await expect(page.getByText('GitHub activity is unavailable right now.', { exact: false })).toHaveCount(0)
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
