import type { VercelRequest, VercelResponse } from "@vercel/node"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  isNowPlayingResponse,
  isSpotifyTrackUrl,
} from "../shared/now-playing.js"
import {
  fetchNowPlayingRequest,
  getDisplayNowPlayingData,
  getRetryAfterDeadline,
} from "../src/lib/use-now-playing.js"

const TRACK_ID = "4uLU6hMCjMI75M1A2tKUQC"
const TRACK_URL = `https://open.spotify.com/track/${TRACK_ID}`
const NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing"
const RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=1"
const TOKEN_URL = "https://accounts.spotify.com/api/token"

const spotifyTrack = {
  name: "Never Gonna Give You Up",
  artists: [{ name: "Rick Astley" }],
  album: { name: "Whenever You Need Somebody" },
  external_urls: { spotify: TRACK_URL },
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

function tokenResponse(accessToken: string) {
  return jsonResponse({ access_token: accessToken, expires_in: 3_600 })
}

function createResponse() {
  const state: {
    body?: unknown
    status?: number
    headers: Map<string, string | number | readonly string[]>
  } = { headers: new Map() }
  const response = {
    setHeader: vi.fn(
      (name: string, value: string | number | readonly string[]) => {
        state.headers.set(name.toLowerCase(), value)
        return response
      }
    ),
    status: vi.fn((status: number) => {
      state.status = status
      return response
    }),
    json: vi.fn((body: unknown) => {
      state.body = body
      return response
    }),
    end: vi.fn(() => response),
  }

  return { response: response as unknown as VercelResponse, state }
}

async function invokeCookieMigration(method: string) {
  const { default: handler } = await import("../api/clear-spotify-cookies.js")
  const { response, state } = createResponse()

  await handler({ method } as VercelRequest, response)

  return state
}

async function invoke(
  method: string,
  cookie?: string,
  query: VercelRequest["query"] = {}
) {
  const { default: handler } = await import("../api/now-playing.js")
  const { response, state } = createResponse()
  const request = {
    method,
    query,
    headers: cookie === undefined ? {} : { cookie },
  } as VercelRequest

  await handler(request, response)

  return state
}

describe("Spotify now-playing API", () => {
  beforeEach(() => {
    // Both the access token and rate-limit state are module scoped.
    vi.resetModules()
    vi.stubEnv("SPOTIFY_CLIENT_ID", "owner-client-id")
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "owner-client-secret")
    vi.stubEnv("SPOTIFY_REFRESH_TOKEN", "owner-refresh-token")
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("stays cacheable and never emits cookies for legacy-cookie visitors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse("owner-access-token"))
      .mockResolvedValueOnce(
        jsonResponse({ is_playing: true, item: spotifyTrack })
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke(
      "GET",
      "spotify_access_token=visitor-token; spotify_refresh_token=visitor-refresh"
    )

    expect(result.status).toBe(200)
    expect(result.headers.has("set-cookie")).toBe(false)
    expect(result.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=10, stale-while-revalidate=20"
    )
    expect(JSON.stringify([...result.headers, result.body])).not.toContain(
      "visitor-token"
    )
    expect(JSON.stringify([...result.headers, result.body])).not.toContain(
      "visitor-refresh"
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(TOKEN_URL)
    expect(fetchMock.mock.calls[1]?.[0]).toBe(NOW_PLAYING_URL)
  })

  it("does not emit cookies for normal visitors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(tokenResponse("owner-access-token"))
        .mockResolvedValueOnce(
          jsonResponse({ is_playing: true, item: spotifyTrack })
        )
    )

    const result = await invoke("GET", "unrelated=value")

    expect(result.status).toBe(200)
    expect(result.headers.has("set-cookie")).toBe(false)
    expect(result.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=10, stale-while-revalidate=20"
    )
  })

  it("returns 405 without making an upstream request", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("POST")

    expect(result.status).toBe(405)
    expect(result.body).toEqual({ error: "Method not allowed" })
    expect(result.headers.get("allow")).toBe("GET")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects query parameters without making an upstream request", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("GET", undefined, { bypass: "1" })

    expect(result.status).toBe(400)
    expect(result.body).toEqual({ error: "Unexpected query parameters" })
    expect(result.headers.get("cache-control")).toBe("no-store")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falls back from a 204 to the minimal recently-played DTO", async () => {
    const playedAt = new Date(Date.now() - 60_000).toISOString()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse("owner-access-token"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ track: spotifyTrack, played_at: playedAt }],
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("GET")

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      status: "recent",
      track: {
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
        spotifyUrl: TRACK_URL,
      },
    })
    expect(result.headers.has("set-cookie")).toBe(false)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      TOKEN_URL,
      NOW_PLAYING_URL,
      RECENTLY_PLAYED_URL,
    ])
  })

  it("returns idle when the most recent track is older than 24 hours", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse("owner-access-token"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              track: spotifyTrack,
              played_at: new Date(Date.now() - 24 * 60 * 60 * 1_000 - 1).toISOString(),
            },
          ],
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("GET")

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ status: "idle", track: null })
  })

  it("refreshes once and retries current playback after a 401", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse("expired-access-token"))
      .mockResolvedValueOnce(jsonResponse({}, { status: 401 }))
      .mockResolvedValueOnce(tokenResponse("fresh-access-token"))
      .mockResolvedValueOnce(
        jsonResponse({ is_playing: true, item: spotifyTrack })
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("GET")

    expect(result.status).toBe(200)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      TOKEN_URL,
      NOW_PLAYING_URL,
      TOKEN_URL,
      NOW_PLAYING_URL,
    ])
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer expired-access-token",
    })
    expect(fetchMock.mock.calls[3]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer fresh-access-token",
    })
  })

  it("propagates Spotify's full Retry-After without claiming to cache a 429", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse("owner-access-token"))
      .mockResolvedValueOnce(
        jsonResponse({}, { status: 429, headers: { "Retry-After": "601" } })
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("GET")

    expect(result.status).toBe(429)
    expect(result.headers.get("retry-after")).toBe("601")
    expect(result.headers.get("cache-control")).toBe("no-store")
    expect(result.body).toEqual({
      error: "Spotify is temporarily rate limited",
    })

    const cooldownResult = await invoke("GET")
    expect(cooldownResult.status).toBe(429)
    expect(cooldownResult.headers.get("cache-control")).toBe("no-store")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("Spotify cookie migration API", () => {
  it("expires both legacy cookies on an uncached POST", async () => {
    const result = await invokeCookieMigration("POST")

    expect(result.status).toBe(204)
    expect(result.headers.get("cache-control")).toBe("no-store")
    expect(result.headers.get("set-cookie")).toEqual([
      "spotify_access_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      "spotify_refresh_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    ])
  })

  it("rejects other methods without setting cookies", async () => {
    const result = await invokeCookieMigration("GET")

    expect(result.status).toBe(405)
    expect(result.headers.get("allow")).toBe("POST")
    expect(result.headers.has("set-cookie")).toBe(false)
  })
})

describe("shared now-playing DTO validation", () => {
  const validResponse = {
    status: "playing",
    track: {
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      spotifyUrl: TRACK_URL,
    },
  }

  it.each([
    null,
    {},
    { ...validResponse, status: "paused" },
    { ...validResponse, track: { ...validResponse.track, artist: 42 } },
    {
      ...validResponse,
      status: "recent",
      track: null,
    },
  ])("rejects malformed DTOs", (value) => {
    expect(isNowPlayingResponse(value)).toBe(false)
  })

  it.each([
    `http://open.spotify.com/track/${TRACK_ID}`,
    `https://OPEN.SPOTIFY.COM/track/${TRACK_ID}`,
    `https://open.spotify.com:443/track/${TRACK_ID}`,
    `${TRACK_URL}/`,
    `${TRACK_URL}?si=tracking`,
    `${TRACK_URL}?`,
    `${TRACK_URL}#`,
    "not a URL",
  ])("rejects noncanonical Spotify track URL %s", (spotifyUrl) => {
    expect(isSpotifyTrackUrl(spotifyUrl)).toBe(false)
    expect(
      isNowPlayingResponse({
        ...validResponse,
        track: { ...validResponse.track, spotifyUrl },
      })
    ).toBe(false)
  })

  it("accepts a canonical Spotify track URL", () => {
    expect(isSpotifyTrackUrl(TRACK_URL)).toBe(true)
    expect(isNowPlayingResponse(validResponse)).toBe(true)
  })
})

describe("now-playing client data lifetime", () => {
  const response = {
    status: "playing" as const,
    track: {
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      spotifyUrl: TRACK_URL,
    },
  }

  it("hides successful data when failures reach five minutes", () => {
    expect(getDisplayNowPlayingData(response, 1_000, true, 301_000)).toBeNull()
  })

  it("keeps fresh or currently successful data visible", () => {
    expect(getDisplayNowPlayingData(response, 1_000, true, 300_999)).toBe(response)
    expect(getDisplayNowPlayingData(response, 1_000, false, 999_999)).toBe(response)
  })
})

describe("now-playing client rate-limit handling", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("parses Retry-After seconds", () => {
    expect(getRetryAfterDeadline("2.5", 1_000)).toBe(3_500)
  })

  it("parses a Retry-After HTTP date", () => {
    expect(
      getRetryAfterDeadline("Wed, 21 Oct 2015 07:28:00 GMT", 1_000)
    ).toBe(Date.parse("Wed, 21 Oct 2015 07:28:00 GMT"))
  })

  it("uses a short fallback when Retry-After is missing", () => {
    expect(getRetryAfterDeadline(null, 1_000)).toBe(11_000)
  })

  it("does not issue another request before the full Retry-After deadline", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({}, { status: 429, headers: { "Retry-After": "60" } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: "playing",
          track: {
            title: "Never Gonna Give You Up",
            artist: "Rick Astley",
            spotifyUrl: TRACK_URL,
          },
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchNowPlayingRequest()).rejects.toMatchObject({ status: 429 })

    const nextRequest = fetchNowPlayingRequest()
    await vi.advanceTimersByTimeAsync(59_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(nextRequest).resolves.toMatchObject({ status: "playing" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("Spotify cookie migration client", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("skips the request when this migration version is already stored", async () => {
    vi.resetModules()
    const { clearLegacySpotifyCookiesOnce } =
      await import("../src/lib/use-now-playing.js")
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      clearLegacySpotifyCookiesOnce({
        getItem: () => "complete",
        setItem: vi.fn(),
      })
    ).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("deduplicates in-flight calls and stores its marker only after success", async () => {
    vi.resetModules()
    const { clearLegacySpotifyCookiesOnce, SPOTIFY_COOKIE_MIGRATION_KEY } =
      await import("../src/lib/use-now-playing.js")
    let resolveResponse!: (response: Response) => void
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve
    })
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(pendingResponse)
    vi.stubGlobal("fetch", fetchMock)
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }

    const first = clearLegacySpotifyCookiesOnce(storage)
    const second = clearLegacySpotifyCookiesOnce(storage)

    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(storage.setItem).not.toHaveBeenCalled()

    resolveResponse(new Response(null, { status: 204 }))
    await expect(first).resolves.toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      SPOTIFY_COOKIE_MIGRATION_KEY,
      "complete"
    )
    expect(fetchMock).toHaveBeenCalledWith("/api/clear-spotify-cookies", {
      method: "POST",
      cache: "no-store",
    })

    await clearLegacySpotifyCookiesOnce(storage)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not mark a failed migration and retries later", async () => {
    vi.resetModules()
    const { clearLegacySpotifyCookiesOnce } =
      await import("../src/lib/use-now-playing.js")
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }

    await expect(clearLegacySpotifyCookiesOnce(storage)).resolves.toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
    await expect(clearLegacySpotifyCookiesOnce(storage)).resolves.toBe(true)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("still completes when localStorage access fails", async () => {
    vi.resetModules()
    const { clearLegacySpotifyCookiesOnce } =
      await import("../src/lib/use-now-playing.js")
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    )
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked")
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked")
      }),
    }

    await expect(clearLegacySpotifyCookiesOnce(storage)).resolves.toBe(true)
  })
})
