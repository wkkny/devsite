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
    await page.route('**/api/visitors', (route) =>
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

    const emailButton = page.getByRole('button', { name: 'Email', exact: true })
    const copyAddress = page.getByRole('menuitem', { name: 'Copy address' })
    await expect(emailButton).toBeVisible()
    await emailButton.click()
    await copyAddress.click()

    const emailFallback = page.getByRole('link', { name: 'kritiraj.tech@gmail.com' })
    await expect(emailFallback).toBeVisible()
    await expect(emailFallback).toHaveAttribute('href', 'mailto:kritiraj.tech@gmail.com?subject=Reaching%20out%20via%20your%20portfolio')

    await emailButton.click()
    await copyAddress.click()

    const copiedButton = page.getByRole('button', { name: /^Copied/ })
    await expect(copiedButton).toBeVisible()
    await copiedButton.click()
    await copyAddress.click()

    await expect(emailFallback).toBeVisible()
    await expect(emailFallback).toHaveAttribute('href', 'mailto:kritiraj.tech@gmail.com?subject=Reaching%20out%20via%20your%20portfolio')
    await page.clock.runFor(1600)
    await expect(emailFallback).toBeVisible()
  })

  // A narrow desktop window at 390px, not a phone: it has a mouse, so it keeps webmail.
  test(`email menu offers each mail client in a ${width}px desktop window`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.context().route('https://mail.google.com/**', (route) => route.fulfill({ body: 'compose' }))
    await page.goto('/')

    await page.getByRole('button', { name: 'Email', exact: true }).click()
    for (const name of ['Gmail', 'Outlook', 'Mail app', 'Copy address']) {
      await expect(page.getByRole('menuitem', { name })).toBeVisible()
    }

    const popup = page.waitForEvent('popup')
    await page.getByRole('menuitem', { name: 'Gmail' }).click()
    const compose = await popup
    await compose.waitForLoadState()
    expect(compose.url()).toContain('tf=cm')
    expect(compose.url()).toContain('to=kritiraj.tech%40gmail.com')
    expect(compose.url()).toContain('su=Reaching%20out%20via%20your%20portfolio')
    expect(compose.url()).not.toContain('body=')
  })

  test(`email menu offers the copy when no mail app answers at ${width}px`, async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')

    await page.getByRole('button', { name: 'Email', exact: true }).click()
    const mailApp = page.getByRole('menuitem', { name: 'Mail app' })
    await expect(mailApp).toHaveAttribute('href', /^mailto:kritiraj\.tech@gmail\.com\?subject=/)
    await mailApp.click()

    // Headless Chromium has no mailto handler, so nothing takes focus from the page.
    await expect(page.getByRole('button', { name: 'Opening app' })).toBeVisible()
    await expect(page.getByText("Didn't open?")).toBeVisible({ timeout: 4000 })
    // The pill keeps its name; the question sits beside it.
    await expect(page.getByRole('button', { name: 'Email', exact: true })).toBeVisible()

    // The way out copies in one press, and keyboard focus lands back on the pill.
    const copyOffer = page.getByRole('button', { name: 'Copy address', exact: true })
    await copyOffer.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeFocused()
    await expect(copyOffer).toBeHidden()
  })
}

// Real time throughout: the page's animations don't settle under Playwright's fake clock. It runs
// at one width, since it has to outwait the offer's timers.
test('the copy offer stays while it is being used', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Email', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Mail app' }).click()
  const copyOffer = page.getByRole('button', { name: 'Copy address', exact: true })
  await expect(copyOffer).toBeVisible({ timeout: 4000 })

  // Held past the 6s it would otherwise last.
  await copyOffer.hover()
  await page.waitForTimeout(6500)
  await expect(copyOffer).toBeVisible()

  // Let go, and it leaves a few seconds later.
  await page.mouse.move(5, 5)
  await expect(copyOffer).toBeHidden({ timeout: 4000 })
})

test.describe('on a phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  // Webmail compose links don't open compose in mobile browsers, so phones get their mail app.
  test('the email menu offers the mail app, not webmail', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Email', exact: true }).click()

    await expect(page.getByRole('menuitem', { name: 'Copy address' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Open mail app' })).toBeVisible()
    await expect(page.getByText('Open in', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Gmail' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Outlook' })).toHaveCount(0)
  })
})
