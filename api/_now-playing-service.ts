import type { NowPlayingResponse } from "../shared/now-playing.js"
import {
  SpotifyConfigurationError,
  SpotifyRequestError,
  SpotifyTimeoutError,
} from "./_spotify.js"
import type {
  SharedSpotifyState,
  SpotifyStateStore,
  StoredSnapshot,
} from "./_spotify-shared-state.js"

const SNAPSHOT_FRESH_MS = 2 * 60 * 1_000
const RECENTLY_PLAYED_REFRESH_MS = 15 * 60 * 1_000
const EMPTY_REFRESH_RETRY_SECONDS = 5
const STATE_UNAVAILABLE_RETRY_SECONDS = 30
const UPSTREAM_FAILURE_RETRY_SECONDS = 60

export type NowPlayingOutcome =
  | {
      kind: "playback"
      playback: NowPlayingResponse
      stale?: boolean
      retryAfterSeconds?: number
    }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | {
      kind: "unavailable"
      status: 502 | 503
      retryAfterSeconds?: number
    }

type NowPlayingServiceDependencies = {
  stateStore: SpotifyStateStore | null
  getPlayback: (refreshRecentWhenIdle: boolean) => Promise<NowPlayingResponse>
  now?: () => number
}

function asRecentPlayback(state: SharedSpotifyState): NowPlayingResponse | null {
  const playback = state.snapshot?.playback
  if (!playback) return null
  if (!playback.track) return playback
  return { status: "recent", track: playback.track }
}

function remainingSeconds(until: number, now: number) {
  return Math.max(1, Math.ceil((until - now) / 1_000))
}

function playbackOutcome(
  playback: NowPlayingResponse,
  options: { stale?: boolean; retryAfterSeconds?: number } = {},
): NowPlayingOutcome {
  return { kind: "playback", playback, ...options }
}

function asCoalescedOutcome(outcome: NowPlayingOutcome): NowPlayingOutcome {
  if (outcome.kind !== "playback" || !outcome.playback.track) return outcome

  return playbackOutcome(
    { status: "recent", track: outcome.playback.track },
    {
      stale: true,
      ...(outcome.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: outcome.retryAfterSeconds }),
    },
  )
}

export function createNowPlayingService({
  stateStore,
  getPlayback,
  now = Date.now,
}: NowPlayingServiceDependencies) {
  let localRefreshInFlight: Promise<NowPlayingOutcome> | undefined

  function stateOutcome(state: SharedSpotifyState): NowPlayingOutcome | null {
    const currentTime = now()
    const rateLimited = state.cooldownUntil > currentTime
    const until = Math.max(state.cooldownUntil, state.backoffUntil)
    if (until > currentTime) {
      const retryAfterSeconds = remainingSeconds(until, currentTime)
      const playback = asRecentPlayback(state)
      return playback
        ? playbackOutcome(playback, { stale: true, retryAfterSeconds })
        : rateLimited
          ? { kind: "rate-limited", retryAfterSeconds }
          : { kind: "unavailable", status: 503, retryAfterSeconds }
    }
    const snapshot = state.snapshot
    return snapshot && currentTime - snapshot.fetchedAt < SNAPSHOT_FRESH_MS
      ? playbackOutcome(snapshot.playback)
      : null
  }

  async function refreshPlayback(
    state: SharedSpotifyState,
    lockToken: string,
    store: SpotifyStateStore,
  ): Promise<NowPlayingOutcome> {
    let keepLockUntilExpiry = false

    try {
      // A different instance may have published a snapshot or backoff since our first read.
      try {
        state = await store.read()
      } catch {
        console.error("[spotify] shared state post-lock read failed")
        return {
          kind: "unavailable",
          status: 503,
          retryAfterSeconds: STATE_UNAVAILABLE_RETRY_SECONDS,
        }
      }
      const cached = stateOutcome(state)
      if (cached) return cached
      const snapshot = state.snapshot
      const shouldRefreshRecent =
        !snapshot?.recentlyPlayedAt ||
        now() - snapshot.recentlyPlayedAt >= RECENTLY_PLAYED_REFRESH_MS
      let playback = await getPlayback(shouldRefreshRecent)

      if (!playback.track && snapshot?.playback.track) {
        playback = { status: "recent", track: snapshot.playback.track }
      }

      const recentlyPlayedAt =
        shouldRefreshRecent && playback.status !== "playing"
          ? now()
          : snapshot?.recentlyPlayedAt
      const nextSnapshot: StoredSnapshot = {
        playback,
        fetchedAt: now(),
        ...(recentlyPlayedAt === undefined ? {} : { recentlyPlayedAt }),
      }

      try {
        await store.writeSnapshot(nextSnapshot)
      } catch {
        console.error("[spotify] shared state snapshot write failed")
        keepLockUntilExpiry = true
        const stalePlayback = asRecentPlayback(state)
        return stalePlayback
          ? playbackOutcome(stalePlayback, {
              stale: true,
              retryAfterSeconds: STATE_UNAVAILABLE_RETRY_SECONDS,
            })
          : {
              kind: "unavailable",
              status: 503,
              retryAfterSeconds: STATE_UNAVAILABLE_RETRY_SECONDS,
            }
      }

      return playbackOutcome(playback)
    } catch (error) {
      if (error instanceof SpotifyRequestError && error.status === 429) {
        const fallbackCooldown = error.reason === "QUOTA_EXCEEDED" ? 3_600 : 60
        const retryAfter = Math.max(1, error.retryAfterSeconds ?? fallbackCooldown)
        let cooldownUntil = now() + retryAfter * 1_000

        try {
          cooldownUntil = await store.extendCooldown(retryAfter)
        } catch {
          console.error("[spotify] shared state cooldown write failed")
          keepLockUntilExpiry = true
        }

        const retryAfterSeconds = remainingSeconds(cooldownUntil, now())
        console.error("[spotify] upstream request rate limited", {
          endpoint: error.endpoint,
          reason: error.reason,
          retryAfterSeconds,
        })

        const stalePlayback = asRecentPlayback(state)
        return stalePlayback
          ? playbackOutcome(stalePlayback, { stale: true, retryAfterSeconds })
          : { kind: "rate-limited", retryAfterSeconds }
      }

      const isTimeout = error instanceof SpotifyTimeoutError
      const isConfigurationError = error instanceof SpotifyConfigurationError
      console.error("[spotify] now-playing request failed", {
        kind: isTimeout ? "timeout" : isConfigurationError ? "configuration" : "unexpected",
        status: error instanceof SpotifyRequestError ? error.status : undefined,
        endpoint: error instanceof SpotifyRequestError ? error.endpoint : undefined,
      })

      let backoffUntil = now() + UPSTREAM_FAILURE_RETRY_SECONDS * 1_000
      try {
        backoffUntil = await store.extendBackoff(UPSTREAM_FAILURE_RETRY_SECONDS)
      } catch {
        console.error("[spotify] shared state backoff write failed")
        keepLockUntilExpiry = true
      }
      const retryAfterSeconds = remainingSeconds(backoffUntil, now())
      const stalePlayback = asRecentPlayback(state)
      return stalePlayback
        ? playbackOutcome(stalePlayback, { stale: true, retryAfterSeconds })
        : {
            kind: "unavailable",
            status: isTimeout || isConfigurationError ? 503 : 502,
            retryAfterSeconds,
          }
    } finally {
      if (!keepLockUntilExpiry) {
        try {
          await store.releaseRefreshLock(lockToken)
        } catch {
          console.error("[spotify] shared state lock release failed")
        }
      }
    }
  }

  return async function getNowPlaying(): Promise<NowPlayingOutcome> {
    if (!stateStore) {
      console.error("[spotify] shared state is required in deployed environments")
      return {
        kind: "unavailable",
        status: 503,
        retryAfterSeconds: STATE_UNAVAILABLE_RETRY_SECONDS,
      }
    }

    let state: SharedSpotifyState
    try {
      state = await stateStore.read()
    } catch {
      console.error("[spotify] shared state read failed")
      return {
        kind: "unavailable",
        status: 503,
        retryAfterSeconds: STATE_UNAVAILABLE_RETRY_SECONDS,
      }
    }

    const cached = stateOutcome(state)
    if (cached) return cached

    let lockToken: string | null
    try {
      lockToken = await stateStore.acquireRefreshLock()
    } catch {
      console.error("[spotify] shared state lock failed")
      const playback = asRecentPlayback(state)
      return playback
        ? playbackOutcome(playback, { stale: true })
        : {
            kind: "unavailable",
            status: 503,
            retryAfterSeconds: STATE_UNAVAILABLE_RETRY_SECONDS,
          }
    }

    if (!lockToken) {
      if (localRefreshInFlight) {
        return asCoalescedOutcome(await localRefreshInFlight)
      }

      try {
        const latestState = await stateStore.read()
        const cached = stateOutcome(latestState)
        if (cached) return cached

        const playback = asRecentPlayback(latestState)
        if (playback) return playbackOutcome(playback, { stale: true })
      } catch {
        // The first read succeeded; serve a short retry window if the second read fails.
      }

      return {
        kind: "unavailable",
        status: 503,
        retryAfterSeconds: EMPTY_REFRESH_RETRY_SECONDS,
      }
    }

    const refresh = refreshPlayback(state, lockToken, stateStore)
    localRefreshInFlight = refresh
    try {
      return await refresh
    } finally {
      if (localRefreshInFlight === refresh) localRefreshInFlight = undefined
    }
  }
}
