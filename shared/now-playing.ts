type PlaybackStatus = "playing" | "recent" | "idle"

export interface NowPlayingTrack {
  title: string
  artist: string
  spotifyUrl: string
  album?: string
  imageUrl?: string
  /** When the track finished playing, in milliseconds since the epoch. Absent while playing. */
  playedAt?: number
}

export interface NowPlayingResponse {
  status: PlaybackStatus
  track: NowPlayingTrack | null
}

export function spotifySearchUrl(title: string, artist: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`
}

export function isSpotifyTrackUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (/^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}$/.test(value) ||
      /^https:\/\/open\.spotify\.com\/search\/[^/?#\s]+$/.test(value))
  )
}

export function isAlbumImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^https:\/\/lastfm\.freetls\.fastly\.net\/i\/u\/[A-Za-z0-9/._-]+$/.test(value)
  )
}

function isOptional(value: unknown, check: (value: unknown) => boolean) {
  return value === undefined || check(value)
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
    isSpotifyTrackUrl(trackRecord.spotifyUrl) &&
    isOptional(trackRecord.album, (album) => typeof album === "string" && Boolean(album)) &&
    isOptional(trackRecord.imageUrl, isAlbumImageUrl) &&
    isOptional(
      trackRecord.playedAt,
      (playedAt) => typeof playedAt === "number" && Number.isFinite(playedAt) && playedAt > 0,
    )

  if (!validStatus) return false
  if (response.status === "idle") return track === null
  return validTrack
}
