import { useEffect, useState } from 'react'
import { PiSpotifyLogo } from 'react-icons/pi'

import { Tooltip } from '@/components/motion/tooltip'
import {
  isNowPlayingResponse,
  type NowPlayingResponse,
} from '../../shared/now-playing'

const useMock = import.meta.env.DEV && import.meta.env.VITE_SPOTIFY_USE_MOCK !== 'false'
const mockTracks = [
  { title: 'Save Your Tears', artist: 'The Weeknd' },
  { title: 'Bohemian Rhapsody', artist: 'Queen' },
  { title: 'The Less I Know the Better', artist: 'Tame Impala' },
  { title: 'Everybody Wants to Rule the World', artist: 'Tears for Fears' },
  {
    title: 'A Very Long Song Title That Tests Track Truncation',
    artist: 'A Very Long Artist Name That Tests Artist Truncation',
  },
] as const
const mockPlaybacks = mockTracks.map(({ title, artist }): NowPlayingResponse => ({
  status: 'playing',
  track: {
    title,
    artist,
    spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`,
  },
}))

export function SpotifyStatus() {
  const [mockIndex, setMockIndex] = useState(0)
  const [livePlayback, setLivePlayback] = useState<NowPlayingResponse | null>(null)
  const playback = useMock ? mockPlaybacks[mockIndex] : livePlayback

  useEffect(() => {
    if (useMock) return

    let controller: AbortController | null = null

    async function refresh() {
      controller?.abort()
      const request = new AbortController()
      controller = request

      try {
        const response = await fetch('/api/now-playing', { signal: request.signal })
        if (!response.ok) throw new Error('Spotify playback is unavailable')

        const data: unknown = await response.json()
        if (!isNowPlayingResponse(data)) throw new Error('Invalid Spotify playback')

        setLivePlayback(data)
      } catch {
        if (!request.signal.aborted) setLivePlayback(null)
      }
    }

    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)

    return () => {
      window.clearInterval(interval)
      controller?.abort()
    }
  }, [])

  if (!playback?.track || playback.status === 'idle') return null

  return (
    <>
      <p className="w-fit min-w-0 max-w-full text-sm leading-6 text-muted-foreground">
        {!useMock && (
          <span className="sr-only">
            {playback.status === 'playing' ? 'Now playing on Spotify: ' : 'Last played on Spotify: '}
          </span>
        )}
        <Tooltip content="Open in Spotify" side="top" wrapperClassName="w-full min-w-0">
          <a
            className="group flex w-fit min-w-0 max-w-full items-center gap-2 text-muted-foreground"
            href={playback.track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <PiSpotifyLogo aria-hidden="true" className="size-6 shrink-0" />
            <span className="flex min-w-0 flex-1 items-baseline gap-1">
              <span className="min-w-0 truncate font-medium text-foreground underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current group-focus-visible:decoration-current sm:shrink-0 sm:overflow-visible sm:text-clip sm:whitespace-nowrap">
                {playback.track.title}
              </span>
              <span className="min-w-0 max-w-[40%] shrink overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-none sm:shrink-0 sm:overflow-visible sm:text-clip sm:whitespace-nowrap">
                by {playback.track.artist}
              </span>
            </span>
          </a>
        </Tooltip>
      </p>
      {useMock && (
        <button
          type="button"
          className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          aria-label={`Show next Spotify example. Currently showing example ${mockIndex + 1} of ${mockPlaybacks.length}.`}
          onClick={() => setMockIndex((index) => (index + 1) % mockPlaybacks.length)}
        >
          Next example ({mockIndex + 1}/{mockPlaybacks.length})
        </button>
      )}
    </>
  )
}
