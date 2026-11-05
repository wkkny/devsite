import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const coverUrl = 'https://lastfm.freetls.fastly.net/i/u/300x300/4d1a0d3b8c1e4f2a9b6c7d8e9f0a1b2c.jpg'
const coverPath = fileURLToPath(new URL('../src/assets/profile-picture.webp', import.meta.url))
const track = {
  title: 'Bohemian Rhapsody',
  artist: 'Queen',
  spotifyUrl: 'https://open.spotify.com/search/Bohemian%20Rhapsody%20Queen',
  album: 'A Night at the Opera',
  imageUrl: coverUrl,
}

async function stubApis(page: Page, playback: unknown) {
  await page.route('https://github-contributions-api.jogruber.de/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contributions: [] }) }),
  )
  await page.route('**/api/visitors', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 42 }) }),
  )
  await page.route(coverUrl, (route) => route.fulfill({ path: coverPath, contentType: 'image/webp' }))
  await page.route('**/api/now-playing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(playback) }),
  )
}

test('a recent track shows how long ago it played and its details on hover', async ({ page }) => {
  await page.clock.setFixedTime(Date.UTC(2026, 10, 6, 12))
  await stubApis(page, {
    status: 'recent',
    track: { ...track, playedAt: Date.UTC(2026, 10, 6, 10) },
  })
  await page.goto('/')

  const link = page.locator(`a[href="${track.spotifyUrl}"]`)
  await expect(link).toContainText('Bohemian Rhapsody')
  await expect(link).toContainText('2h ago')
  await expect(link.locator('.now-playing-bars')).toHaveCount(0)

  await link.hover()
  const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: 'A Night at the Opera' })
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('Played 2h ago · Open in Spotify')
  await expect(tooltip.locator(`img[src="${coverUrl}"]`)).toBeVisible()
  await expect
    .poll(() => tooltip.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)
})

test('a playing track shows the live bars and no play time', async ({ page }) => {
  await stubApis(page, { status: 'playing', track })
  await page.goto('/')

  const link = page.locator(`a[href="${track.spotifyUrl}"]`)
  await expect(link.locator('.now-playing-bars')).toBeVisible()
  await expect(link).not.toContainText('ago')
  await expect(page.getByText('Now playing on Spotify:')).toBeAttached()

  await link.hover()
  const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: 'A Night at the Opera' })
  await expect(tooltip).toContainText('Listening now · Open in Spotify')
})
