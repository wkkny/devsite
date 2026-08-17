import { useCallback, useEffect, useState } from "react"

import { USE_MOCK_SPOTIFY_DATA } from "@/config/spotify"

interface Track {
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

interface NowPlayingResponse {
  is_playing: boolean
  item?: Track | null
  progress_ms?: number
  played_at?: string
  error?: string
}

const MOCK_NOW_PLAYING: NowPlayingResponse = {
  is_playing: true,
  item: {
    name: "Bohemian Rhapsody",
    artists: [{ name: "Queen" }],
    album: {
      name: "A Night at the Opera",
      images: [],
    },
    external_urls: {
      spotify: "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv",
    },
  },
}

async function fetchNowPlayingData(): Promise<NowPlayingResponse> {
  if (USE_MOCK_SPOTIFY_DATA) {
    return MOCK_NOW_PLAYING
  }

  try {
    const response = await fetch("/api/now-playing")

    if (response.status === 401) {
      return { is_playing: false, error: "Not authenticated" }
    }

    if (!response.ok) {
      return { is_playing: false, error: "Failed to fetch" }
    }

    return (await response.json()) as NowPlayingResponse
  } catch {
    return { is_playing: false, error: "Failed to fetch" }
  }
}

export function useNowPlaying(pollInterval = 10_000) {
  const [data, setData] = useState<NowPlayingResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    const result = await fetchNowPlayingData()

    setData(result)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchNowPlayingData().then((result) => {
      setData(result)
      setIsLoading(false)
    })

    if (USE_MOCK_SPOTIFY_DATA) {
      return undefined
    }

    const interval = window.setInterval(() => {
      fetchNowPlayingData().then(setData)
    }, pollInterval)

    return () => window.clearInterval(interval)
  }, [pollInterval])

  return { data, isLoading, refetch }
}
