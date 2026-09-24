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

async function invoke(method = 'GET', query: Record<string, string> = {}) {
  vi.resetModules()
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
    if (url === 'https://api.spotify.com/v1/me/player/recently-played?limit=1') {
      return recentResponse ?? jsonResponse({ items: [] })
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
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
    expect(response.headers.get('cache-control')).toContain('s-maxage=10')
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
