import { useEffect, useState } from 'react'
import { PiSpotifyLogo } from 'react-icons/pi'

import { Tooltip } from '@/components/motion/tooltip'
import {
  isNowPlayingResponse,
  type NowPlayingResponse,
} from '../../shared/now-playing'

const useMock = import.meta.env.DEV && import.meta.env.VITE_SPOTIFY_USE_MOCK !== 'false'
const mockPlayback: NowPlayingResponse = {
  status: 'playing',
  track: {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    spotifyUrl: 'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
  },
}

export function SpotifyStatus() {
  const [playback, setPlayback] = useState<NowPlayingResponse | null>(
    useMock ? mockPlayback : null,
  )

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

        setPlayback(data)
      } catch {
        if (!request.signal.aborted) setPlayback(null)
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
              <span className="min-w-0 flex-1 truncate font-medium text-foreground underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current group-focus-visible:decoration-current">
                {playback.track.title}
              </span>
              <span className="min-w-0 max-w-[40%] shrink overflow-hidden text-ellipsis whitespace-nowrap">
                by {playback.track.artist}
              </span>
            </span>
          </a>
        </Tooltip>
      </p>
    </>
  )
}
