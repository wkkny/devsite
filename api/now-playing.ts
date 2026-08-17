import type { VercelRequest, VercelResponse } from "@vercel/node"

import {
  getSpotifyCookies,
  refreshAccessToken,
  setSpotifyCookies,
} from "./_spotify.js"

const NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing"
const RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=1"

type SpotifyTrack = {
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string; width: number; height: number }[]
  }
  external_urls: {
    spotify: string
  }
}

type PlaybackResponse = {
  is_playing: boolean
  item?: SpotifyTrack | null
  played_at?: string
}

type RecentlyPlayedResponse = {
  items?: Array<{
    track: SpotifyTrack
    played_at: string
  }>
}

function fetchSpotify(url: string, accessToken: string) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

async function getLastPlayed(accessToken: string) {
  const response = await fetchSpotify(RECENTLY_PLAYED_URL, accessToken)

  if (!response.ok) {
    return { is_playing: false }
  }

  const data = (await response.json()) as RecentlyPlayedResponse
  const lastPlayed = data.items?.[0]

  return {
    is_playing: false,
    item: lastPlayed?.track,
    played_at: lastPlayed?.played_at,
  } satisfies PlaybackResponse
}

async function getNowOrLastPlayed(accessToken: string) {
  const response = await fetchSpotify(NOW_PLAYING_URL, accessToken)

  if (response.status === 204) {
    return getLastPlayed(accessToken)
  }

  if (!response.ok) {
    return response
  }

  const data = (await response.json()) as PlaybackResponse

  if (!data.item) {
    return getLastPlayed(accessToken)
  }

  return data
}

async function sendPlaybackResponse(
  result: Response | PlaybackResponse,
  res: VercelResponse
) {
  if (result instanceof Response) {
    return res.status(result.status).json({ error: "Spotify request failed" })
  }

  return res.json(result)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { refreshToken, accessToken: initialAccessToken } = getSpotifyCookies(
    req.headers.cookie
  )
  let accessToken = initialAccessToken

  if (!accessToken && !refreshToken) {
    return res.status(401).json({ error: "Not authenticated" })
  }

  try {
    if (!accessToken && refreshToken) {
      const token = await refreshAccessToken(refreshToken)
      accessToken = token.access_token
      setSpotifyCookies(res, token)
    }

    const result = await getNowOrLastPlayed(accessToken!)

    if (
      !(result instanceof Response) ||
      result.status !== 401 ||
      !refreshToken
    ) {
      return sendPlaybackResponse(result, res)
    }

    const token = await refreshAccessToken(refreshToken)
    setSpotifyCookies(res, token)

    return sendPlaybackResponse(
      await getNowOrLastPlayed(token.access_token),
      res
    )
  } catch {
    return res.status(500).json({ error: "Failed to fetch now playing" })
  }
}
