import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { Tooltip } from '@/components/tooltip'
import { EASE_OUT } from '@/lib/ease'
import { formatRelativeTime } from '@/lib/relative-time'
import {
  isNowPlayingResponse,
  spotifySearchUrl,
  type NowPlayingResponse,
  type NowPlayingTrack,
} from '../../shared/now-playing'

const useMock = import.meta.env.DEV && import.meta.env.VITE_SPOTIFY_USE_MOCK !== 'false'
const POLL_INTERVAL_MS = 120_000
const POLL_JITTER_MS = 15_000
const CLOCK_TICK_MS = 60_000
const HOUR_MS = 60 * 60 * 1_000
const mockTracks = [
  { title: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours' },
  { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', hoursAgo: 2 },
  { title: 'The Less I Know the Better', artist: 'Tame Impala', album: 'Currents', hoursAgo: 72 },
  {
    title: 'Everybody Wants to Rule the World',
    artist: 'Tears for Fears',
    album: 'Songs from the Big Chair',
    hoursAgo: 400,
  },
  {
    title: 'A Very Long Song Title That Tests Track Truncation',
    artist: 'A Very Long Artist Name That Tests Artist Truncation',
    hoursAgo: 0.5,
  },
]
const mockPlaybacks = mockTracks.map(({ title, artist, album, hoursAgo }): NowPlayingResponse => ({
  status: hoursAgo === undefined ? 'playing' : 'recent',
  track: {
    title,
    artist,
    spotifyUrl: spotifySearchUrl(title, artist),
    ...(album ? { album } : {}),
    ...(hoursAgo === undefined ? {} : { playedAt: Date.now() - hoursAgo * HOUR_MS }),
  },
}))

// Re-renders once a minute so "2h ago" stays accurate between polls. Call the
// returned function when new data arrives so it isn't compared with a stale clock.
function useNow() {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => window.clearInterval(timer)
  }, [])

  const updateNow = useCallback(() => setNow(Date.now()), [])

  return [now, updateNow] as const
}

function TrackDetails({ track, playing, now }: { track: NowPlayingTrack; playing: boolean; now: number }) {
  const when = playing
    ? 'Listening now'
    : track.playedAt === undefined
      ? null
      : `Played ${formatRelativeTime(track.playedAt, now)}`

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {track.imageUrl && (
        <img
          src={track.imageUrl}
          alt=""
          width={48}
          height={48}
          referrerPolicy="no-referrer"
          className="size-12 shrink-0 rounded-md object-cover"
        />
      )}
      <span className="flex min-w-0 flex-col leading-snug">
        <span className="truncate">{track.title}</span>
        {track.album && <span className="truncate font-normal text-muted-foreground">{track.album}</span>}
        <span className="mt-1 type-label text-muted-foreground">
          {when && `${when} · `}Open in Spotify
        </span>
      </span>
    </span>
  )
}

export function SpotifyStatus() {
  const [mockIndex, setMockIndex] = useState(0)
  const [livePlayback, setLivePlayback] = useState<NowPlayingResponse | null>(null)
  // The last track Spotify reported. Kept so the widget keeps showing the
  // last played song when Spotify goes idle or a poll fails (e.g. 429s).
  const [lastTrack, setLastTrack] = useState<NowPlayingTrack | null>(null)
  const playback = useMock ? mockPlaybacks[mockIndex] : livePlayback
  const [now, updateNow] = useNow()

  useEffect(() => {
    if (useMock) return

    let controller: AbortController | null = null
    let pausedUntil = 0
    let pollTimer: number | undefined
    let stopped = false

    function backoffUntil(headers: Headers) {
      const value = headers.get('Retry-After')
      if (value === null) return null

      const seconds = Number(value)
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Date.now() + seconds * 1_000
      }

      const retryAt = Date.parse(value)
      return Number.isNaN(retryAt) ? null : Math.max(retryAt, Date.now())
    }

    async function refresh() {
      // While rate limited, back off instead of hammering the endpoint.
      if (Date.now() < pausedUntil) return

      controller?.abort()
      const request = new AbortController()
      controller = request

      try {
        const response = await fetch('/api/now-playing', { signal: request.signal })
        const retryAt = backoffUntil(response.headers)

        if (response.status === 429) {
          pausedUntil = Math.max(pausedUntil, retryAt ?? Date.now() + 60_000)
          throw new Error("Spotify is temporarily rate limited")
        }

        if (retryAt !== null) pausedUntil = Math.max(pausedUntil, retryAt)
        if (!response.ok) throw new Error('Spotify playback is unavailable')

        const data: unknown = await response.json()
        if (!isNowPlayingResponse(data)) throw new Error('Invalid Spotify playback')

        setLivePlayback(data)
        updateNow()
        if (data.track) setLastTrack(data.track)

      } catch {
        if (request.signal.aborted) return

        // Keep the last known track, but playback is no longer confirmed, so
        // stop announcing it as currently playing.
        setLivePlayback((previous) =>
          previous?.track && previous.status !== 'recent'
            ? { status: 'recent', track: previous.track }
            : previous,
        )
      }
    }

    async function poll() {
      if (stopped) return
      if (document.visibilityState !== 'hidden') await refresh()
      if (stopped) return

      const cooldownMs = Math.max(0, pausedUntil - Date.now())
      const delay = Math.max(POLL_INTERVAL_MS, cooldownMs) + Math.random() * POLL_JITTER_MS
      pollTimer = window.setTimeout(() => void poll(), delay)
    }

    void poll()

    return () => {
      stopped = true
      if (pollTimer !== undefined) window.clearTimeout(pollTimer)
      controller?.abort()
    }
  }, [updateNow])

  const reducedMotion = useReducedMotion()
  const barsRef = useRef<HTMLSpanElement>(null)
  const track = playback?.track ?? lastTrack
  const playing = playback?.status === 'playing'
  const imageUrl = track?.imageUrl

  // Load the cover ahead of time so the tooltip doesn't open with an empty frame.
  useEffect(() => {
    if (!imageUrl) return
    const image = new Image()
    image.referrerPolicy = 'no-referrer'
    image.src = imageUrl
  }, [imageUrl])

  const showBars = Boolean(track) && playback?.status === 'playing'
  // The equalizer loops forever, so it rests while scrolled out of view.
  useEffect(() => {
    const bars = barsRef.current
    if (!showBars || !bars || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) delete bars.dataset.offscreen
      else bars.dataset.offscreen = ''
    })
    observer.observe(bars)
    return () => observer.disconnect()
  }, [showBars])

  if (!track) return null

  return (
    <>
      <p className="w-fit min-w-0 max-w-full text-sm leading-6 text-muted-foreground">
        {!useMock && (
          <span className="sr-only">
            {playing ? 'Now playing on Spotify: ' : 'Last played on Spotify: '}
          </span>
        )}
        <Tooltip
          content={<TrackDetails track={track} playing={playing} now={now} />}
          side="top"
          className={imageUrl ? 'p-2' : undefined}
        >
          <a
            className="group relative flex w-fit min-w-0 max-w-full items-center gap-2 text-muted-foreground"
            href={track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* A new track rolls in from below while the last one lifts away. */}
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={`${track.title}\u0000${track.artist}`}
                className="flex min-w-0 flex-1 items-baseline gap-1"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: 'blur(3px)' }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: 'blur(3px)' }}
                transition={{ duration: 0.26, ease: EASE_OUT }}
              >
                  <span className="min-w-0 truncate text-foreground underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current group-focus-visible:decoration-current sm:shrink-0 sm:overflow-visible sm:text-clip sm:whitespace-nowrap">
                    {track.title}
                  </span>
                  <span className="min-w-0 shrink-[2] overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-none sm:shrink-0 sm:overflow-visible sm:text-clip sm:whitespace-nowrap">
                    by {track.artist}
                  </span>
                  {!playing && track.playedAt !== undefined && (
                    <span className="shrink-0 text-nowrap tabular-nums">
                      <span aria-hidden="true">· </span>
                      {formatRelativeTime(track.playedAt, now)}
                    </span>
                  )}
              </motion.span>
            </AnimatePresence>
            {/* The equalizer scales in and out with the track change instead of popping. */}
            <AnimatePresence initial={false}>
              {playing && (
                <motion.span
                  key="bars"
                  ref={barsRef}
                  aria-hidden="true"
                  className="now-playing-bars"
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                >
                  <span />
                  <span />
                  <span />
                </motion.span>
              )}
            </AnimatePresence>
          </a>
        </Tooltip>
      </p>
      {useMock && (
        <button
          type="button"
          className="mt-1 type-label text-muted-foreground underline underline-offset-2 hover:text-foreground"
          aria-label={`Show next Spotify example. Currently showing example ${mockIndex + 1} of ${mockPlaybacks.length}.`}
          onClick={() => setMockIndex((index) => (index + 1) % mockPlaybacks.length)}
        >
          Next example ({mockIndex + 1}/{mockPlaybacks.length})
        </button>
      )}
    </>
  )
}
