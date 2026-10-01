import { describe, expect, it, vi } from 'vitest'

import { createNowPlayingService } from '../api/_now-playing-service'
import type { SharedSpotifyState, SpotifyStateStore } from '../api/_spotify-shared-state'
import type { NowPlayingResponse } from '../shared/now-playing'

const now = 1_000_000
const playback: NowPlayingResponse = {
  status: 'playing',
  track: {
    title: 'Runaway',
    artist: 'Kanye West',
    spotifyUrl: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds',
  },
}

function setup(latest: SharedSpotifyState) {
  let state: SharedSpotifyState = { snapshot: null, cooldownUntil: 0, backoffUntil: 0 }
  const store = {
    read: vi.fn(async () => state),
    writeSnapshot: vi.fn(async () => {}),
    extendCooldown: vi.fn(async () => 0),
    extendBackoff: vi.fn(async () => 0),
    acquireRefreshLock: vi.fn(async () => {
      // Simulate a different worker finishing after the initial read.
      state = latest
      return 'lock-token'
    }),
    releaseRefreshLock: vi.fn(async () => {}),
  } satisfies SpotifyStateStore
  const getPlayback = vi.fn(async () => playback)
  const service = createNowPlayingService({ stateStore: store, getPlayback, now: () => now })
  return { store, getPlayback, service }
}

describe('refresh state changes between reading and locking', () => {
  it('honors a cooldown established by another worker', async () => {
    const { store, getPlayback, service } = setup({ snapshot: null, cooldownUntil: now + 60_000, backoffUntil: 0 })

    await expect(service()).resolves.toEqual({ kind: 'rate-limited', retryAfterSeconds: 60 })
    expect(getPlayback).not.toHaveBeenCalled()
    expect(store.releaseRefreshLock).toHaveBeenCalledWith('lock-token')
  })

  it('serves the latest stored track as recent during a new cooldown', async () => {
    const { store, getPlayback, service } = setup({
      snapshot: { playback, fetchedAt: now - 300_000 },
      cooldownUntil: now + 60_000,
      backoffUntil: 0,
    })

    await expect(service()).resolves.toEqual({
      kind: 'playback',
      playback: { ...playback, status: 'recent' },
      stale: true,
      retryAfterSeconds: 60,
    })
    expect(getPlayback).not.toHaveBeenCalled()
    expect(store.releaseRefreshLock).toHaveBeenCalledWith('lock-token')
  })

  it('reuses a fresh snapshot published by another worker', async () => {
    const { store, getPlayback, service } = setup({
      snapshot: { playback, fetchedAt: now },
      cooldownUntil: 0,
      backoffUntil: 0,
    })

    await expect(service()).resolves.toEqual({ kind: 'playback', playback })
    expect(getPlayback).not.toHaveBeenCalled()
    expect(store.writeSnapshot).not.toHaveBeenCalled()
    expect(store.releaseRefreshLock).toHaveBeenCalledWith('lock-token')
  })

  it('avoids upstream calls and releases the lock when the locked read fails', async () => {
    const { store, getPlayback, service } = setup({ snapshot: null, cooldownUntil: 0, backoffUntil: 0 })
    store.read.mockResolvedValueOnce({ snapshot: null, cooldownUntil: 0, backoffUntil: 0 })
      .mockRejectedValueOnce(new Error('Redis unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(service()).resolves.toEqual({
      kind: 'unavailable', status: 503, retryAfterSeconds: 30,
    })
    expect(getPlayback).not.toHaveBeenCalled()
    expect(store.releaseRefreshLock).toHaveBeenCalledWith('lock-token')
  })

  it('preserves the stale track if the locked read fails', async () => {
    const state = {
      snapshot: { playback, fetchedAt: now - 300_000 },
      cooldownUntil: 0,
      backoffUntil: 0,
    }
    const { store, getPlayback, service } = setup(state)
    store.read.mockResolvedValueOnce(state).mockRejectedValueOnce(new Error('Redis unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(service()).resolves.toEqual({
      kind: 'playback',
      playback: { ...playback, status: 'recent' },
      stale: true,
      retryAfterSeconds: 30,
    })
    expect(getPlayback).not.toHaveBeenCalled()
    expect(store.releaseRefreshLock).toHaveBeenCalledWith('lock-token')
  })

})
