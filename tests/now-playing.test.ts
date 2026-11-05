import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isNowPlayingResponse } from '../shared/now-playing'

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/'
const coverUrl = 'https://lastfm.freetls.fastly.net/i/u/300x300/4d1a0d3b8c1e4f2a9b6c7d8e9f0a1b2c.jpg'

const scrobble = {
  name: '  Runaway  ',
  artist: { mbid: '', '#text': ' Kanye West ' },
  album: { mbid: '', '#text': 'My Beautiful Dark Twisted Fantasy' },
  image: [
    { size: 'small', '#text': 'https://lastfm.freetls.fastly.net/i/u/34s/4d1a0d3b8c1e4f2a9b6c7d8e9f0a1b2c.jpg' },
    { size: 'medium', '#text': 'https://lastfm.freetls.fastly.net/i/u/64s/4d1a0d3b8c1e4f2a9b6c7d8e9f0a1b2c.jpg' },
    { size: 'extralarge', '#text': coverUrl },
  ],
  url: 'https://www.last.fm/music/Kanye+West/_/Runaway',
}
const playedAtSeconds = 1_762_400_000
const nowPlayingScrobble = { ...scrobble, '@attr': { nowplaying: 'true' } }
const playedScrobble = { ...scrobble, date: { uts: String(playedAtSeconds), '#text': '06 Nov 2025, 03:33' } }

const expectedTrack = {
  title: 'Runaway',
  artist: 'Kanye West',
  spotifyUrl: 'https://open.spotify.com/search/Runaway%20Kanye%20West',
  album: 'My Beautiful Dark Twisted Fantasy',
  imageUrl: coverUrl,
}
const expectedPlayedTrack = { ...expectedTrack, playedAt: playedAtSeconds * 1_000 }

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function recentTracks(track: unknown) {
  return jsonResponse({ recenttracks: { track, '@attr': { user: 'test-user' } } })
}

function makeResponse() {
  const headers = new Map<string, string>()
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value)
      return this
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
  }

  return { ...response, headers } as typeof response & { headers: Map<string, string> }
}

async function invoke(
  method = 'GET',
  query: Record<string, string> = {},
  options: { resetModules?: boolean } = {},
) {
  if (options.resetModules !== false) vi.resetModules()
  const { default: handler } = await import('../api/now-playing')
  const request = { method, query } as unknown as VercelRequest
  const response = makeResponse()

  await handler(request, response as unknown as VercelResponse)
  return response
}

function mockLastfmFetch(getResponse: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.startsWith(`${LASTFM_API}?`)) return getResponse()

    throw new Error(`Unexpected fetch URL: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('GET /api/now-playing', () => {
  beforeEach(() => {
    vi.stubEnv('LASTFM_API_KEY', 'test-api-key')
    vi.stubEnv('LASTFM_USERNAME', 'test-user')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps a now-playing scrobble into the public response shape', async () => {
    const fetchMock = mockLastfmFetch(() => recentTracks([nowPlayingScrobble, playedScrobble]))

    const response = await invoke()

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ status: 'playing', track: expectedTrack })
    expect(response.headers.get('cache-control')).toContain('s-maxage=30')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(Object.fromEntries(url.searchParams)).toEqual({
      method: 'user.getrecenttracks',
      user: 'test-user',
      api_key: 'test-api-key',
      format: 'json',
      limit: '1',
    })
  })

  it('returns the latest scrobble with its play time when nothing is playing', async () => {
    mockLastfmFetch(() => recentTracks([playedScrobble]))

    const response = await invoke()

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ status: 'recent', track: expectedPlayedTrack })
  })

  it('accepts a single scrobble returned as an object instead of an array', async () => {
    mockLastfmFetch(() => recentTracks(playedScrobble))

    const response = await invoke()

    expect(response.body).toEqual({ status: 'recent', track: expectedPlayedTrack })
  })

  it('omits the placeholder cover and an empty album', async () => {
    mockLastfmFetch(() =>
      recentTracks([
        {
          ...playedScrobble,
          album: { mbid: '', '#text': '' },
          image: [
            {
              size: 'extralarge',
              '#text': 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png',
            },
          ],
        },
      ]),
    )

    const response = await invoke()

    expect(response.body).toEqual({
      status: 'recent',
      track: {
        title: 'Runaway',
        artist: 'Kanye West',
        spotifyUrl: 'https://open.spotify.com/search/Runaway%20Kanye%20West',
        playedAt: playedAtSeconds * 1_000,
      },
    })
  })

  it('skips unmappable scrobbles to serve the most recent playable track', async () => {
    mockLastfmFetch(() =>
      recentTracks([
        { ...scrobble, name: '   ', '@attr': { nowplaying: 'true' } },
        { ...scrobble, date: { uts: 'not-a-timestamp' } },
        playedScrobble,
      ]),
    )

    const response = await invoke()

    expect(response.body).toEqual({ status: 'recent', track: expectedPlayedTrack })
  })

  it('returns idle when there is no listening history', async () => {
    mockLastfmFetch(() => recentTracks([]))

    const response = await invoke()

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ status: 'idle', track: null })
  })

  it('keeps serving the last played track when the history comes back empty', async () => {
    let currentTime = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    let tracks: unknown[] = [playedScrobble]
    mockLastfmFetch(() => recentTracks(tracks))

    const first = await invoke()
    expect(first.body).toEqual({ status: 'recent', track: expectedPlayedTrack })

    currentTime += 2 * 60 * 1000 + 1
    tracks = []

    const second = await invoke('GET', {}, { resetModules: false })
    expect(second.statusCode).toBe(200)
    expect(second.body).toEqual({ status: 'recent', track: expectedPlayedTrack })
  })

  it('serves the last played track and backs off when Last.fm is rate limited', async () => {
    let currentTime = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    let rateLimited = false
    const fetchMock = mockLastfmFetch(() =>
      rateLimited
        ? jsonResponse({ error: 29, message: 'Rate limit exceeded' }, 429, { 'Retry-After': '30' })
        : recentTracks([nowPlayingScrobble]),
    )

    const first = await invoke()
    expect(first.statusCode).toBe(200)
    expect(first.body).toEqual({ status: 'playing', track: expectedTrack })

    // Expire the shared playback snapshot so the next refresh reaches Last.fm.
    currentTime += 2 * 60 * 1000 + 1
    rateLimited = true
    const second = await invoke('GET', {}, { resetModules: false })
    expect(second.statusCode).toBe(200)
    expect(second.body).toEqual({ status: 'recent', track: expectedTrack })
    expect(second.headers.get('retry-after')).toBe('30')
    expect(second.headers.get('cache-control')).toBe('no-store')

    // While the rate limit window is active, the cached track is served
    // without contacting Last.fm again.
    const callsAfterSecond = fetchMock.mock.calls.length
    const third = await invoke('GET', {}, { resetModules: false })
    expect(third.statusCode).toBe(200)
    expect(third.body).toEqual({ status: 'recent', track: expectedTrack })
    expect(fetchMock.mock.calls.length).toBe(callsAfterSecond)
  })

  it('treats a rate-limit error code as a cooldown even with a 200 status', async () => {
    mockLastfmFetch(() => jsonResponse({ error: 29, message: 'Rate limit exceeded' }))

    const response = await invoke()

    expect(response.statusCode).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
  })

  it.each([
    [6, 'User not found'],
    [10, 'Invalid API key'],
    [17, 'Login: User required to be logged in'],
  ])('reports Last.fm error %i as unavailable configuration', async (code, message) => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLastfmFetch(() => jsonResponse({ error: code, message }, 403))

    const response = await invoke()

    expect(response.statusCode).toBe(503)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(errorLog).toHaveBeenCalledWith(
      '[spotify] now-playing request failed',
      expect.objectContaining({ kind: 'configuration' }),
    )
  })

  it('reports missing credentials as unavailable without contacting Last.fm', async () => {
    vi.stubEnv('LASTFM_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await invoke()

    expect(response.statusCode).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('coalesces concurrent requests into a single upstream fetch', async () => {
    const pending: Array<(response: Response) => void> = []
    const fetchMock = mockLastfmFetch(() => {
      const deferred = Promise.withResolvers<Response>()
      pending.push(deferred.resolve)
      return deferred.promise
    })

    vi.resetModules()
    const { default: handler } = await import('../api/now-playing')

    const runHandler = async () => {
      const request = { method: 'GET', query: {} } as unknown as VercelRequest
      const response = makeResponse()
      await handler(request, response as unknown as VercelResponse)
      return response
    }

    const first = runHandler()
    await vi.waitFor(() => expect(pending).toHaveLength(1))

    // The second request joins the in-flight refresh instead of starting its
    // own upstream call.
    const second = runHandler()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(pending).toHaveLength(1)

    pending[0](recentTracks([nowPlayingScrobble]))
    const [firstResponse, secondResponse] = await Promise.all([first, second])

    expect(firstResponse.statusCode).toBe(200)
    expect(firstResponse.body).toEqual({ status: 'playing', track: expectedTrack })
    expect(firstResponse.headers.get('cache-control')).toContain('s-maxage=30')
    expect(secondResponse.statusCode).toBe(200)
    expect(secondResponse.body).toEqual({ status: 'recent', track: expectedTrack })
    expect(secondResponse.headers.get('cache-control')).toBe('no-store')

    // The shared snapshot answers later requests until its two-minute cache expires.
    const third = await runHandler()

    expect(third.statusCode).toBe(200)
    expect(third.body).toEqual({ status: 'playing', track: expectedTrack })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported methods and unexpected query parameters without contacting Last.fm', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const methodResponse = await invoke('POST')
    const queryResponse = await invoke('GET', { extra: 'value' })

    expect(methodResponse.statusCode).toBe(405)
    expect(methodResponse.headers.get('allow')).toBe('GET')
    expect(queryResponse.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('isNowPlayingResponse', () => {
  const track = { title: 'Runaway', artist: 'Kanye West', spotifyUrl: expectedTrack.spotifyUrl }

  it('accepts Spotify track and search links', () => {
    expect(isNowPlayingResponse({ status: 'recent', track })).toBe(true)
    expect(
      isNowPlayingResponse({
        status: 'recent',
        track: { ...track, spotifyUrl: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds' },
      }),
    ).toBe(true)
  })

  it('rejects covers from other hosts and invalid play times', () => {
    expect(
      isNowPlayingResponse({ status: 'recent', track: { ...track, imageUrl: 'https://example.com/cover.jpg' } }),
    ).toBe(false)
    expect(isNowPlayingResponse({ status: 'recent', track: { ...track, playedAt: -1 } })).toBe(false)
    expect(isNowPlayingResponse({ status: 'recent', track: { ...track, album: '' } })).toBe(false)
  })
})
