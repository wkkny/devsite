import { expect, test, type Page } from '@playwright/test'

const bohemianRhapsody = {
  status: 'playing',
  track: {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    spotifyUrl: 'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
  },
}

async function stubThirdPartyApis(page: Page) {
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
}

async function advancePoll(page: Page) {
  const responsePromise = page.waitForResponse('**/api/now-playing')
  await page.clock.runFor(30_000)
  await responsePromise
}

test('spotify status keeps showing the last played track when playback stops or requests fail', async ({ page }) => {
  await page.clock.install()
  await stubThirdPartyApis(page)

  let mode: 'playing' | 'idle' | 'rate-limited' = 'playing'
  let requestCount = 0
  await page.route('**/api/now-playing', (route) => {
    requestCount += 1
    if (mode === 'playing') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(bohemianRhapsody),
      })
    }
    if (mode === 'idle') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'idle', track: null }),
      })
    }
    return route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'Retry-After': '60' },
      body: JSON.stringify({ error: 'Spotify is temporarily rate limited' }),
    })
  })

  await page.goto('/')

  const trackLink = page.getByRole('link', { name: 'Bohemian Rhapsody by Queen' })
  await expect(trackLink).toBeVisible()

  // Playback history runs out: the widget keeps showing the last played track.
  mode = 'idle'
  await advancePoll(page)
  await expect(trackLink).toBeVisible()

  // Rate limited: the widget keeps showing the last played track.
  mode = 'rate-limited'
  await advancePoll(page)
  await expect(trackLink).toBeVisible()

  // The client honors Retry-After and skips the next poll.
  mode = 'playing'
  const countBeforeBackoff = requestCount
  await page.clock.runFor(30_000)
  expect(requestCount).toBe(countBeforeBackoff)

  // Once the backoff window passes, polling resumes.
  await advancePoll(page)
  expect(requestCount).toBe(countBeforeBackoff + 1)
  await expect(trackLink).toBeVisible()
})
