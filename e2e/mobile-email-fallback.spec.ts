import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`email remains available after a failed retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(() => {
      let writeCount = 0
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => {
            writeCount += 1
            if (writeCount !== 2) throw new DOMException('Clipboard access denied', 'NotAllowedError')
          },
        },
      })
    })
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
        body: JSON.stringify({ status: 'idle', track: null }),
      }),
    )

    await page.goto('/')
    await page.clock.install()

    const copyButton = page.getByRole('button', { name: 'Copy email address' })
    await expect(copyButton).toBeVisible()
    await copyButton.click()

    const emailFallback = page.getByRole('link', { name: 'kritiraj.tech@gmail.com' })
    await expect(emailFallback).toBeVisible()
    await expect(emailFallback).toHaveAttribute('href', 'mailto:kritiraj.tech@gmail.com')

    const retryButton = page.getByRole('button', { name: 'Copy email address' })
    await retryButton.click()

    const copiedButton = page.getByRole('button', { name: 'Copy email address' })
    await expect(copiedButton).toBeVisible()
    await copiedButton.click()

    await expect(emailFallback).toBeVisible()
    await expect(emailFallback).toHaveAttribute('href', 'mailto:kritiraj.tech@gmail.com')
    await page.clock.runFor(1600)
    await expect(emailFallback).toBeVisible()
  })

}
