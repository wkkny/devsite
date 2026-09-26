import {
  isSpotifyTrackUrl,
  type NowPlayingResponse,
  type NowPlayingTrack,
} from "../shared/now-playing.js"
import {
  getRetryAfterSeconds,
  getSpotifyAccessToken,
  getSpotifyErrorReason,
  SpotifyRequestError,
  SpotifyTimeoutError,
} from "./_spotify.js"

const NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing"
const RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=10"
const REQUEST_TIMEOUT_MS = 4_000

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

async function readSpotifyJson(response: Response, endpoint: string) {
  if (!response.ok) {
    throw new SpotifyRequestError(
      response.status,
      getRetryAfterSeconds(response),
      await getSpotifyErrorReason(response),
      endpoint,
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
  const data = await readSpotifyJson(response, "recently-played")

  if (!isRecord(data) || !Array.isArray(data.items)) {
    throw new Error("Invalid Spotify recently-played response")
  }

  // History can include podcast episodes or local files that have no Spotify track URL.
  for (const item of data.items) {
    if (!isRecord(item) || typeof item.played_at !== "string") continue
    if (Number.isNaN(Date.parse(item.played_at))) continue

    const track = mapTrack(item.track)
    if (track) return { status: "recent", track }
  }

  return { status: "idle", track: null }
}

async function getPlayback(
  accessToken: string,
  refreshRecentWhenIdle: boolean,
): Promise<NowPlayingResponse> {
  const response = await fetchSpotify(NOW_PLAYING_URL, accessToken)

  if (response.status === 204) {
    return refreshRecentWhenIdle
      ? getRecentlyPlayed(accessToken)
      : { status: "idle", track: null }
  }

  const data = await readSpotifyJson(response, "currently-playing")
  if (!isRecord(data) || typeof data.is_playing !== "boolean") {
    throw new Error("Invalid Spotify now-playing response")
  }

  const track = mapTrack(data.item)
  if (!data.is_playing || !track) {
    return refreshRecentWhenIdle
      ? getRecentlyPlayed(accessToken)
      : { status: "idle", track: null }
  }

  return { status: "playing", track }
}

export async function getSpotifyPlayback(
  refreshRecentWhenIdle: boolean,
): Promise<NowPlayingResponse> {
  const accessToken = await getSpotifyAccessToken()

  try {
    return await getPlayback(accessToken, refreshRecentWhenIdle)
  } catch (error) {
    if (!(error instanceof SpotifyRequestError) || error.status !== 401) {
      throw error
    }

    return getPlayback(await getSpotifyAccessToken(true), refreshRecentWhenIdle)
  }
}
