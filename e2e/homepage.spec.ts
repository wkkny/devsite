import { expect, test } from '@playwright/test'

test('homepage loads and its main controls work', async ({ page }) => {
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

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Kritiraj (Kenny)' })).toBeVisible()
  await expect(page.getByText('Design Engineer', { exact: true })).toBeVisible()
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

  await page.getByRole('button', { name: 'Add a draggable item' }).click()
  await page.getByRole('menuitem', { name: 'Next.js' }).click()
  await expect(page.getByRole('button', { name: 'Next.js logo', exact: true })).toBeVisible()
})
