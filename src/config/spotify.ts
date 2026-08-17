type SpotifyAuthMode = "public" | "private"

function getSpotifyAuthMode(): SpotifyAuthMode {
  return import.meta.env.VITE_SPOTIFY_AUTH_MODE === "private"
    ? "private"
    : "public"
}

export const SPOTIFY_AUTH_MODE = getSpotifyAuthMode()

export const USE_MOCK_SPOTIFY_DATA =
  import.meta.env.DEV && import.meta.env.VITE_SPOTIFY_DEV_AUTH !== "true"

export const ALLOW_SPOTIFY_LOGIN =
  SPOTIFY_AUTH_MODE === "public" && !USE_MOCK_SPOTIFY_DATA
