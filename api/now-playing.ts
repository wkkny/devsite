import type { VercelRequest, VercelResponse } from "@vercel/node"

import {
  isSpotifyTrackUrl,
  type NowPlayingResponse,
  type NowPlayingTrack,
} from "../shared/now-playing.js"
import {
  getRetryAfterSeconds,
  getSpotifyAccessToken,
  SpotifyConfigurationError,
  SpotifyRequestError,
  SpotifyTimeoutError,
} from "./_spotify.js"

const NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing"
const RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=1"
const REQUEST_TIMEOUT_MS = 4_000
const CACHE_CONTROL =
  "public, max-age=0, s-maxage=30, stale-while-revalidate=30"

let rateLimitedUntil = 0
// The most recent track fetched from Spotify, kept so the page keeps showing
// the last played song when Spotify goes idle, times out, or rate limits us.
let lastKnownTrack: NowPlayingTrack | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function mapTrack(value: unknown): NowPlayingTrack | null {
  if (!isRecord(value) || typeof value.name !== "string") return null
  if (!Array.isArray(value.artists) || value.artists.length === 0) return null
  if (!isRecord(value.external_urls)) return null

  const spotifyUrl = value.external_urls.spotify

  if (!isSpotifyTrackUrl(spotifyUrl)) return null

  const artists = value.artists.map((artist) => {
    if (!isRecord(artist) || typeof artist.name !== "string") return null
    return artist.name.trim()
  })

  const title = value.name.trim()

  if (!title || artists.some((artist) => !artist)) return null

  return { title, artist: artists.join(", "), spotifyUrl }
}

async function fetchSpotify(url: string, accessToken: string) {
  try {
    return await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SpotifyTimeoutError()
    }

    throw error
  }
}

async function readSpotifyJson(response: Response) {
  if (!response.ok) {
    throw new SpotifyRequestError(
      response.status,
      getRetryAfterSeconds(response)
    )
  }

  try {
    return (await response.json()) as unknown
  } catch {
    throw new Error("Invalid Spotify response")
  }
}

async function getRecentlyPlayed(accessToken: string): Promise<NowPlayingResponse> {
  const response = await fetchSpotify(RECENTLY_PLAYED_URL, accessToken)
  const data = await readSpotifyJson(response)

  if (!isRecord(data) || !Array.isArray(data.items)) {
    throw new Error("Invalid Spotify recently-played response")
  }

  const item = data.items[0]

  if (item === undefined) {
    return { status: "idle", track: null }
  }

  if (!isRecord(item) || typeof item.played_at !== "string") {
    throw new Error("Invalid Spotify recently-played item")
  }

  const track = mapTrack(item.track)

  if (!track || Number.isNaN(Date.parse(item.played_at))) {
    throw new Error("Invalid Spotify recently-played track")
  }

  return { status: "recent", track }
}

async function getPlayback(accessToken: string): Promise<NowPlayingResponse> {
  const response = await fetchSpotify(NOW_PLAYING_URL, accessToken)

  if (response.status === 204) {
    return getRecentlyPlayed(accessToken)
  }

  const data = await readSpotifyJson(response)

  if (!isRecord(data) || typeof data.is_playing !== "boolean") {
    throw new Error("Invalid Spotify now-playing response")
  }

  const track = mapTrack(data.item)

  if (!data.is_playing || !track) {
    return getRecentlyPlayed(accessToken)
  }

  return { status: "playing", track }
}

async function getPlaybackWithRefresh() {
  const accessToken = await getSpotifyAccessToken()

  try {
    return await getPlayback(accessToken)
  } catch (error) {
    if (!(error instanceof SpotifyRequestError) || error.status !== 401) {
      throw error
    }

    return getPlayback(await getSpotifyAccessToken(true))
  }
}

function sendRateLimited(
  res: VercelResponse,
  retryAfterSeconds: number
) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Retry-After", String(retryAfterSeconds))
  return res.status(429).json({ error: "Spotify is temporarily rate limited" })
}

function sendLastKnownTrack(res: VercelResponse, retryAfterSeconds?: number) {
  if (retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(retryAfterSeconds))
  }
  res.setHeader("Cache-Control", "no-store")
  return res.status(200).json({ status: "recent", track: lastKnownTrack })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    res.setHeader("Cache-Control", "no-store")
    return res.status(405).json({ error: "Method not allowed" })
  }

  if (Object.keys(req.query ?? {}).length > 0) {
    res.setHeader("Cache-Control", "no-store")
    return res.status(400).json({ error: "Unexpected query parameters" })
  }

  const remainingRateLimit = Math.ceil((rateLimitedUntil - Date.now()) / 1_000)

  if (remainingRateLimit > 0) {
    if (lastKnownTrack) return sendLastKnownTrack(res, remainingRateLimit)
    return sendRateLimited(res, remainingRateLimit)
  }

  try {
    let result = await getPlaybackWithRefresh()

    if (result.track) {
      lastKnownTrack = result.track
    } else if (lastKnownTrack) {
      // Spotify has no playback history to report. Keep serving the last
      // played track so the widget never disappears.
      result = { status: "recent", track: lastKnownTrack }
    }

    res.setHeader("Cache-Control", CACHE_CONTROL)
    return res.status(200).json(result)
  } catch (error) {
    res.setHeader("Cache-Control", "no-store")

    if (error instanceof SpotifyRequestError && error.status === 429) {
      const retryAfter = error.retryAfterSeconds ?? 10
      rateLimitedUntil = Date.now() + retryAfter * 1_000
      console.error("[spotify] upstream request failed", { status: 429 })

      if (lastKnownTrack) {
        // Rate limited by Spotify: keep showing the last played track and
        // tell the client to back off instead of hiding the widget.
        return sendLastKnownTrack(res, retryAfter)
      }

      return sendRateLimited(res, retryAfter)
    }

    if (error instanceof SpotifyTimeoutError) {
      console.error("[spotify] upstream request timed out")
      if (lastKnownTrack) return sendLastKnownTrack(res)
      return res.status(504).json({ error: "Spotify is temporarily unavailable" })
    }

    const isConfigurationError = error instanceof SpotifyConfigurationError

    console.error("[spotify] now-playing request failed", {
      kind:
        error instanceof SpotifyRequestError
          ? "upstream"
          : isConfigurationError
            ? "configuration"
            : "unexpected",
      status: error instanceof SpotifyRequestError ? error.status : undefined,
    })
    if (!isConfigurationError && lastKnownTrack) {
      return sendLastKnownTrack(res)
    }

    return res
      .status(isConfigurationError ? 503 : 502)
      .json({ error: "Failed to fetch Spotify playback" })
  }
}
