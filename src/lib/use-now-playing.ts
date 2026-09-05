import { useQuery } from "@tanstack/react-query"

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

  const response = await fetch("/api/now-playing")

  if (response.status === 401) {
    return { is_playing: false, error: "Not authenticated" }
  }

  if (!response.ok) {
    throw new Error("Failed to fetch now playing")
  }

  return (await response.json()) as NowPlayingResponse
}

export function useNowPlaying(pollInterval = 10_000) {
  const query = useQuery({
    queryKey: ["now-playing"],
    queryFn: fetchNowPlayingData,
    refetchInterval: USE_MOCK_SPOTIFY_DATA ? false : pollInterval,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    retry: 2,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    refetch: query.refetch,
  }
}
