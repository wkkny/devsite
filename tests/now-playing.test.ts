import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const currentTrack = {
  name: '  Runaway  ',
  artists: [{ name: 'Kanye West' }, { name: ' Pusha T ' }],
  external_urls: { spotify: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds' },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
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

function mockSpotifyFetch(currentResponse: Response, recentResponse?: Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url === 'https://accounts.spotify.com/api/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 })
    }
    if (url === 'https://api.spotify.com/v1/me/player/currently-playing') {
      return currentResponse
    }
    if (url === 'https://api.spotify.com/v1/me/player/recently-played?limit=10') {
      return recentResponse ?? jsonResponse({ items: [] })
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mockSpotifyFetchWith(
  getCurrent: () => Response,
  getRecent: () => Response = () => jsonResponse({ items: [] }),
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url === 'https://accounts.spotify.com/api/token') {
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 })
    }
    if (url === 'https://api.spotify.com/v1/me/player/currently-playing') {
      return getCurrent()
    }
    if (url === 'https://api.spotify.com/v1/me/player/recently-played?limit=10') {
      return getRecent()
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const expectedTrack = {
  title: 'Runaway',
  artist: 'Kanye West, Pusha T',
  spotifyUrl: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds',
}

describe('GET /api/now-playing', () => {
  beforeEach(() => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id')
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret')
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token')
  })

  it('maps a current Spotify track into the public response shape', async () => {
    const fetchMock = mockSpotifyFetch(jsonResponse({ is_playing: true, item: currentTrack }))

    const response = await invoke()

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      status: 'playing',
      track: {
        title: 'Runaway',
        artist: 'Kanye West, Pusha T',
        spotifyUrl: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds',
      },
    })
    expect(response.headers.get('cache-control')).toContain('s-maxage=30')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns the recent track when Spotify has no active playback', async () => {
    const playedAt = new Date().toISOString()
    mockSpotifyFetch(
      new Response(null, { status: 204 }),
      jsonResponse({ items: [{ played_at: playedAt, track: currentTrack }] }),
    )

    const response = await invoke()

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      status: 'recent',
      track: {
        title: 'Runaway',
        artist: 'Kanye West, Pusha T',
        spotifyUrl: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds',
      },
    })
  })

  it('returns the most recent track even when it was played more than 24 hours ago', async () => {
    const playedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    mockSpotifyFetch(
      jsonResponse({ is_playing: false, item: currentTrack }),
      jsonResponse({ items: [{ played_at: playedAt, track: currentTrack }] }),
    )

    const response = await invoke()

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      status: 'recent',
      track: {
        title: 'Runaway',
        artist: 'Kanye West, Pusha T',
        spotifyUrl: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds',
      },
    })
  })

  it('keeps serving the last played track when Spotify has no playback history', async () => {
    let recentItems: unknown[] = [{ played_at: new Date().toISOString(), track: currentTrack }]
    mockSpotifyFetchWith(
      () => new Response(null, { status: 204 }),
      () => jsonResponse({ items: recentItems }),
    )

    const first = await invoke()
    expect(first.statusCode).toBe(200)
    expect(first.body).toEqual({ status: 'recent', track: expectedTrack })

    recentItems = []

    const second = await invoke('GET', {}, { resetModules: false })
    expect(second.statusCode).toBe(200)
    expect(second.body).toEqual({ status: 'recent', track: expectedTrack })
  })

  it('serves the last played track and backs off when Spotify is rate limited', async () => {
    let rateLimited = false
    const fetchMock = mockSpotifyFetchWith(() =>
      rateLimited
        ? new Response(JSON.stringify({ error: 'too many requests' }), {
            status: 429,
            headers: { 'Retry-After': '30' },
          })
        : jsonResponse({ is_playing: true, item: currentTrack }),
    )

    const first = await invoke()
    expect(first.statusCode).toBe(200)
    expect(first.body).toEqual({ status: 'playing', track: expectedTrack })

    rateLimited = true
    const second = await invoke('GET', {}, { resetModules: false })
    expect(second.statusCode).toBe(200)
    expect(second.body).toEqual({ status: 'recent', track: expectedTrack })
    expect(second.headers.get('retry-after')).toBe('30')
    expect(second.headers.get('cache-control')).toBe('no-store')

    // While the rate limit window is active, the cached track is served
    // without contacting Spotify again.
    const callsAfterSecond = fetchMock.mock.calls.length
    const third = await invoke('GET', {}, { resetModules: false })
    expect(third.statusCode).toBe(200)
    expect(third.body).toEqual({ status: 'recent', track: expectedTrack })
    expect(fetchMock.mock.calls.length).toBe(callsAfterSecond)
  })

  it('coalesces concurrent requests into a single upstream fetch', async () => {
    const currentTrack = {
      name: 'Runaway',
      artists: [{ name: 'Kanye West' }, { name: ' Pusha T ' }],
      external_urls: { spotify: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds' },
    }

    const resolveCurrentlyPlaying: Array<(response: Response) => void> = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === 'https://accounts.spotify.com/api/token') {
        return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 })
      }
      if (url === 'https://api.spotify.com/v1/me/player/currently-playing') {
        const deferred = Promise.withResolvers<Response>()
        resolveCurrentlyPlaying.push(deferred.resolve)
        return deferred.promise
      }
      if (url === 'https://api.spotify.com/v1/me/player/recently-played?limit=10') {
        return jsonResponse({ items: [] })
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    vi.resetModules()
    const { default: handler } = await import('../api/now-playing')

    const runHandler = async () => {
      const request = { method: 'GET', query: {} } as unknown as VercelRequest
      const response = makeResponse()
      await handler(request, response as unknown as VercelResponse)
      return response
    }

    const first = runHandler()
    await vi.waitFor(() => expect(resolveCurrentlyPlaying).toHaveLength(1))

    // The second request joins the in-flight fetch instead of starting its
    // own upstream call.
    const second = runHandler()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(resolveCurrentlyPlaying).toHaveLength(1)

    resolveCurrentlyPlaying[0](jsonResponse({ is_playing: true, item: currentTrack }))
    const [firstResponse, secondResponse] = await Promise.all([first, second])

    const expectedBody = {
      status: 'playing',
      track: {
        title: 'Runaway',
        artist: 'Kanye West, Pusha T',
        spotifyUrl: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds',
      },
    }
    expect(firstResponse.statusCode).toBe(200)
    expect(firstResponse.body).toEqual(expectedBody)
    expect(secondResponse.statusCode).toBe(200)
    expect(secondResponse.body).toEqual(expectedBody)

    // The coalesced result is cached: a later idle request serves the same
    // track without a new Spotify track appearing in history.
    const third = runHandler()
    await vi.waitFor(() => expect(resolveCurrentlyPlaying).toHaveLength(2))
    resolveCurrentlyPlaying[1](new Response(null, { status: 204 }))
    const response = await third

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ status: 'recent', track: expectedBody.track })
  })

  it('skips podcast episodes and unmappable items to serve the most recent playable track', async () => {
    mockSpotifyFetch(
      new Response(null, { status: 204 }),
      jsonResponse({
        items: [
          // Podcast episode: track is null and the episode is ignored.
          {
            played_at: new Date().toISOString(),
            track: null,
            episode: { name: 'Some podcast episode' },
          },
          // Invalid played_at: skipped.
          { played_at: 'not-a-date', track: currentTrack },
          // First playable track in history wins.
          { played_at: new Date().toISOString(), track: currentTrack },
        ],
      }),
    )

    const response = await invoke()

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ status: 'recent', track: expectedTrack })
  })

  it('returns idle when the playback history contains no playable tracks', async () => {
    mockSpotifyFetch(
      new Response(null, { status: 204 }),
      jsonResponse({
        items: [
          { played_at: new Date().toISOString(), track: null, episode: { name: 'Podcast' } },
          { played_at: new Date().toISOString(), track: { name: 'Local file' } },
        ],
      }),
    )

    const response = await invoke()

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ status: 'idle', track: null })
  })

  it('rejects unsupported methods and unexpected query parameters without contacting Spotify', async () => {
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
