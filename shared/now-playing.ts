export type PlaybackStatus = "playing" | "recent" | "idle"

export interface NowPlayingTrack {
  title: string
  artist: string
  spotifyUrl: string
}

export interface NowPlayingResponse {
  status: PlaybackStatus
  track: NowPlayingTrack | null
}

export function isSpotifyTrackUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}$/.test(value)
  )
}

export function isNowPlayingResponse(value: unknown): value is NowPlayingResponse {
  if (typeof value !== "object" || value === null) return false

  const response = value as Record<string, unknown>
  const validStatus =
    response.status === "playing" ||
    response.status === "recent" ||
    response.status === "idle"
  const track = response.track
  const trackRecord =
    typeof track === "object" && track !== null
      ? (track as Record<string, unknown>)
      : null
  const validTrack =
    trackRecord !== null &&
    typeof trackRecord.title === "string" &&
    Boolean(trackRecord.title) &&
    typeof trackRecord.artist === "string" &&
    Boolean(trackRecord.artist) &&
    isSpotifyTrackUrl(trackRecord.spotifyUrl)

  if (!validStatus) return false
  if (response.status === "idle") return track === null
  return validTrack
}
