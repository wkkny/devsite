import { useEffect, useState } from "react"
import { useQuery, type QueryFunctionContext } from "@tanstack/react-query"

import { USE_MOCK_SPOTIFY_DATA } from "@/config/spotify"
import {
  isNowPlayingResponse,
  type NowPlayingResponse,
} from "../../shared/now-playing"

const MOCK_NOW_PLAYING: NowPlayingResponse = {
  status: "playing",
  track: {
    title: "Bohemian Rhapsody",
    artist: "Queen",
    spotifyUrl: "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv",
  },
}

const FAILED_DATA_MAX_AGE_MS = 5 * 60 * 1_000
const RETRY_AFTER_FALLBACK_MS = 10_000
export const SPOTIFY_COOKIE_MIGRATION_KEY =
  "spotify-cookie-migration:v1"

let rateLimitedUntil = 0
let cookieMigrationComplete = false
let cookieMigrationInFlight: Promise<boolean> | undefined

export function getDisplayNowPlayingData(
  data: NowPlayingResponse | undefined,
  dataUpdatedAt: number,
  hasError: boolean,
  now = Date.now()
) {
  if (
    data &&
    hasError &&
    now - dataUpdatedAt >= FAILED_DATA_MAX_AGE_MS
  ) {
    return null
  }

  return data ?? null
}

class NowPlayingRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super("Failed to fetch now playing")
    this.status = status
  }
}

export function getRetryAfterDeadline(
  retryAfter: string | null,
  now = Date.now()
) {
  if (retryAfter !== null && retryAfter.trim() !== "") {
    const seconds = Number(retryAfter)

    if (Number.isFinite(seconds) && seconds >= 0) {
      return now + Math.ceil(seconds * 1_000)
    }

    const date = Date.parse(retryAfter)

    if (!Number.isNaN(date)) return Math.max(date, now)
  }

  return now + RETRY_AFTER_FALLBACK_MS
}

async function waitForRateLimit(signal?: AbortSignal) {
  while (rateLimitedUntil > Date.now()) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError")
    }

    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        signal?.removeEventListener("abort", abort)
        resolve()
      }
      const abort = () => {
        clearTimeout(timer)
        reject(signal?.reason ?? new DOMException("Aborted", "AbortError"))
      }
      const timer = setTimeout(finish, rateLimitedUntil - Date.now())

      signal?.addEventListener("abort", abort, { once: true })
    })
  }
}

export async function fetchNowPlayingRequest(
  signal?: AbortSignal
): Promise<NowPlayingResponse> {
  await waitForRateLimit(signal)

  const response = await fetch("/api/now-playing", { signal })

  if (!response.ok) {
    if (response.status === 429) {
      rateLimitedUntil = Math.max(
        rateLimitedUntil,
        getRetryAfterDeadline(response.headers.get("retry-after"))
      )
    }

    throw new NowPlayingRequestError(response.status)
  }

  const data: unknown = await response.json()

  if (!isNowPlayingResponse(data)) {
    throw new Error("Invalid now-playing response")
  }

  return data
}

async function fetchNowPlayingData({ signal }: QueryFunctionContext) {
  return USE_MOCK_SPOTIFY_DATA
    ? MOCK_NOW_PLAYING
    : fetchNowPlayingRequest(signal)
}

type MigrationStorage = Pick<Storage, "getItem" | "setItem">

function getMigrationStorage(): MigrationStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function clearLegacySpotifyCookiesOnce(
  storage: MigrationStorage | null = getMigrationStorage()
) {
  if (cookieMigrationComplete) return Promise.resolve(true)

  try {
    if (storage?.getItem(SPOTIFY_COOKIE_MIGRATION_KEY) === "complete") {
      cookieMigrationComplete = true
      return Promise.resolve(true)
    }
  } catch {
    // Storage may be unavailable in private or restricted browsing contexts.
  }

  if (cookieMigrationInFlight) return cookieMigrationInFlight

  cookieMigrationInFlight = (async () => {
    try {
      const response = await fetch("/api/clear-spotify-cookies", {
        method: "POST",
        cache: "no-store",
      })

      if (!response.ok) return false

      cookieMigrationComplete = true
      try {
        storage?.setItem(SPOTIFY_COOKIE_MIGRATION_KEY, "complete")
      } catch {
        // A successful migration still applies for this page lifetime.
      }
      return true
    } catch {
      return false
    } finally {
      cookieMigrationInFlight = undefined
    }
  })()

  return cookieMigrationInFlight
}

export function useNowPlaying(pollInterval = 30_000) {
  const query = useQuery({
    queryKey: ["now-playing"],
    queryFn: fetchNowPlayingData,
    refetchInterval: USE_MOCK_SPOTIFY_DATA ? false : pollInterval,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    retry: (failureCount, error) =>
      !(error instanceof NowPlayingRequestError && error.status < 500) &&
      failureCount < 2,
  })
  const [, rerenderAtExpiry] = useState(0)

  useEffect(() => {
    if (!USE_MOCK_SPOTIFY_DATA) void clearLegacySpotifyCookiesOnce()
  }, [])

  useEffect(() => {
    if (!query.data || query.error === null) return

    const remaining =
      query.dataUpdatedAt + FAILED_DATA_MAX_AGE_MS - Date.now()
    if (remaining <= 0) return

    const timer = setTimeout(
      () => rerenderAtExpiry((version) => version + 1),
      remaining
    )
    return () => clearTimeout(timer)
  }, [query.data, query.dataUpdatedAt, query.error])

  return {
    data: getDisplayNowPlayingData(
      query.data,
      query.dataUpdatedAt,
      query.error !== null
    ),
    isLoading: query.isPending,
    refetch: query.refetch,
  }
}
