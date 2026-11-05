import process from "node:process"

import {
  isAlbumImageUrl,
  spotifySearchUrl,
  type NowPlayingResponse,
  type NowPlayingTrack,
} from "../shared/now-playing.js"

const RECENT_TRACKS_URL = "https://ws.audioscrobbler.com/2.0/"
const REQUEST_TIMEOUT_MS = 4_000
// Last.fm's grey star, returned when a track has no album art.
const PLACEHOLDER_IMAGE_ID = "2a96cbd8b46e442fc41c2b86b821562f"

// https://www.last.fm/api/errorcodes
const RATE_LIMIT_ERROR = 29
// Invalid user, invalid API key, private listening history, or a suspended key.
const CONFIGURATION_ERRORS = new Set([6, 10, 17, 26])

export class LastfmRequestError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number | null
  readonly code: number | null

  constructor(
    status: number,
    retryAfterSeconds: number | null = null,
    code: number | null = null,
  ) {
    super("Last.fm request failed")
    this.name = "LastfmRequestError"
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.code = code
  }
}

export class LastfmConfigurationError extends Error {
  constructor() {
    super("Last.fm is not configured")
    this.name = "LastfmConfigurationError"
  }
}

export class LastfmTimeoutError extends Error {
  constructor() {
    super("Last.fm request timed out")
    this.name = "LastfmTimeoutError"
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new LastfmConfigurationError()
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (isRecord(value) && typeof value["#text"] === "string") return value["#text"].trim()
  return ""
}

function getRetryAfterSeconds(response: Response) {
  const header = response.headers.get("retry-after")
  if (header === null) return null

  const seconds = Number(header)

  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)

  const retryAt = Date.parse(header)

  return Number.isNaN(retryAt)
    ? null
    : Math.max(Math.ceil((retryAt - Date.now()) / 1_000), 0)
}

function largestImage(images: unknown) {
  if (!Array.isArray(images)) return undefined

  // Sizes are listed small to extralarge.
  for (const image of images.toReversed()) {
    const url = text(image)
    if (isAlbumImageUrl(url) && !url.includes(PLACEHOLDER_IMAGE_ID)) return url
  }

  return undefined
}

function mapTrack(value: unknown): { track: NowPlayingTrack; nowPlaying: boolean } | null {
  if (!isRecord(value)) return null

  const title = text(value.name)
  const artist = text(value.artist)
  if (!title || !artist) return null

  const nowPlaying = isRecord(value["@attr"]) && value["@attr"].nowplaying === "true"
  const playedAtSeconds = isRecord(value.date) ? Number(value.date.uts) : Number.NaN
  if (!nowPlaying && !(Number.isFinite(playedAtSeconds) && playedAtSeconds > 0)) return null

  const album = text(value.album)
  const imageUrl = largestImage(value.image)

  return {
    nowPlaying,
    track: {
      title,
      artist,
      spotifyUrl: spotifySearchUrl(title, artist),
      ...(album ? { album } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(nowPlaying ? {} : { playedAt: playedAtSeconds * 1_000 }),
    },
  }
}

async function fetchRecentTracks() {
  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: getRequiredEnv("LASTFM_USERNAME"),
    api_key: getRequiredEnv("LASTFM_API_KEY"),
    format: "json",
    limit: "1",
  })

  try {
    return await fetch(`${RECENT_TRACKS_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new LastfmTimeoutError()
    }

    throw error
  }
}

export async function getLastfmPlayback(): Promise<NowPlayingResponse> {
  const response = await fetchRecentTracks()

  let data: unknown
  try {
    data = await response.json()
  } catch {
    data = null
  }

  // Errors arrive as { error, message }, sometimes with a 200 status.
  const code = isRecord(data) && typeof data.error === "number" ? data.error : null
  if (code !== null && CONFIGURATION_ERRORS.has(code)) {
    throw new LastfmConfigurationError()
  }
  if (code === RATE_LIMIT_ERROR || response.status === 429) {
    throw new LastfmRequestError(429, getRetryAfterSeconds(response), code)
  }
  if (!response.ok || code !== null) {
    throw new LastfmRequestError(response.ok ? 502 : response.status, null, code)
  }

  if (!isRecord(data) || !isRecord(data.recenttracks)) {
    throw new Error("Invalid Last.fm recent tracks response")
  }

  // A single track comes back as an object instead of a one-item array.
  const items = data.recenttracks.track
  const tracks = Array.isArray(items) ? items : items === undefined ? [] : [items]

  // The now-playing track, when there is one, comes first.
  for (const item of tracks) {
    const mapped = mapTrack(item)
    if (mapped) {
      return { status: mapped.nowPlaying ? "playing" : "recent", track: mapped.track }
    }
  }

  return { status: "idle", track: null }
}
