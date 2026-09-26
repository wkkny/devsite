import { expect, test, type Page } from '@playwright/test'

const bohemianRhapsodyTrack = {
  title: 'Bohemian Rhapsody',
  artist: 'Queen',
  spotifyUrl: 'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
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

test('spotify status keeps showing the last played track when playback stops or requests fail', async ({ page }) => {
  test.setTimeout(120_000)
  // Pause the clock (not just install it): a running fake clock advances with
  // real time, so slow steps would fire extra interval polls and shift every
  // request count. Paused, only clock.runFor drives time.
  await page.clock.pauseAt(0)
  await stubThirdPartyApis(page)

  type Mode = 'playing' | 'failing' | 'idle' | 'rate-limited' | 'rate-limited-cached'
  let mode: Mode = 'playing'
  let requestCount = 0
  await page.route('**/api/now-playing', (route) => {
    requestCount += 1
    if (mode === 'playing') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'playing', track: bohemianRhapsodyTrack }),
      })
    }
    if (mode === 'failing') {
      return route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to fetch Spotify playback' }),
      })
    }
    if (mode === 'idle') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'idle', track: null }),
      })
    }
    if (mode === 'rate-limited') {
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '60' },
        body: JSON.stringify({ error: 'Spotify is temporarily rate limited' }),
      })
    }
    // The API serves the cached last played track during a rate-limit window
    // with Retry-After, even though the response itself is a 200.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Retry-After': '60' },
      body: JSON.stringify({ status: 'recent', track: bohemianRhapsodyTrack }),
    })
  })

  await page.goto('/')

  const trackLink = page.getByRole('link', { name: 'Bohemian Rhapsody by Queen' })
  await expect(trackLink).toBeVisible()
  await expect(page.getByText('Now playing on Spotify:', { exact: false })).toHaveCount(1)

  // A failed poll keeps the last played track and stops announcing it as
  // currently playing.
  mode = 'failing'
  let previousCount = requestCount
  await page.clock.runFor(136_000)
  await expect.poll(() => requestCount).toBe(previousCount + 1)
  await expect(trackLink).toBeVisible()
  await expect(page.getByText('Now playing on Spotify:', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Last played on Spotify:', { exact: false })).toHaveCount(1)

  // Playback history runs out: the widget keeps showing the last played track.
  mode = 'idle'
  previousCount = requestCount
  await page.clock.runFor(136_000)
  await expect.poll(() => requestCount).toBe(previousCount + 1)
  await expect(trackLink).toBeVisible()

  // Rate limited with a plain 429: the widget keeps showing the last played
  // track, and the client backs off for the Retry-After window.
  mode = 'rate-limited'
  previousCount = requestCount
  await page.clock.runFor(136_000)
  await expect.poll(() => requestCount).toBe(previousCount + 1)
  await expect(trackLink).toBeVisible()
  // requestCount bumps as soon as the route receives the poll, before the
  // page has processed the 429 and started backing off. Give the page real
  // time to process the response (the clock stays paused) before advancing
  // past the interval tick that must be skipped.
  await page.waitForTimeout(250)

  await page.clock.runFor(60_000)
  expect(requestCount).toBe(previousCount + 1)

  // Polling resumes after the 60-second cooldown and two-minute poll interval.
  mode = 'playing'
  await page.clock.runFor(76_000)
  await expect.poll(() => requestCount).toBe(previousCount + 2)
  await expect(trackLink).toBeVisible()

  // A cached 200 response during a rate-limit window also requests backoff
  // via Retry-After.
  mode = 'rate-limited-cached'
  previousCount = requestCount
  await page.clock.runFor(136_000)
  await expect.poll(() => requestCount).toBe(previousCount + 1)
  await expect(trackLink).toBeVisible()
  // Let the page process the cached response's Retry-After before advancing.
  await page.waitForTimeout(250)

  await page.clock.runFor(60_000)
  expect(requestCount).toBe(previousCount + 1)

  mode = 'playing'
  await page.clock.runFor(76_000)
  await expect.poll(() => requestCount).toBe(previousCount + 2)
  await expect(trackLink).toBeVisible()
})
