import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNowPlayingService } from '../api/_now-playing-service'
import { createUpstashSpotifyStateStore } from '../api/_spotify-shared-state'
import { SpotifyRequestError, SpotifyTimeoutError } from '../api/_spotify'

const track = { title: 'Runaway', artist: 'Kanye West', spotifyUrl: 'https://open.spotify.com/track/3DK6m7It6Pw857FcQftMds' }
const playing = { status: 'playing' as const, track }

// A shared Redis REST transport fixture. Each service uses an independent production
// adapter; commands, TTLs, NX locks and token-checked releases cross instance boundaries.
function redisTransport() {
  const values = new Map<string, { value: string; expiresAt?: number }>()
  const commands: Array<Array<string | number>> = []
  function get(key: string) {
    const entry = values.get(key)
    if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      values.delete(key)
      return null
    }
    return entry?.value ?? null
  }
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(_input)).toBe("https://redis.example.test")
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token" })
    const command = JSON.parse(String(init?.body)) as Array<string | number>
    commands.push(command)
    const [operation, ...args] = command
    let result: unknown
    if (operation === 'MGET') result = args.map((key) => get(String(key)))
    else if (operation === 'SET') {
      const [key, value, ex, seconds, nx] = args
      if (nx === 'NX' && get(String(key)) !== null) result = null
      else {
        values.set(String(key), { value: String(value), ...(ex === 'EX' ? { expiresAt: Date.now() + Number(seconds) * 1000 } : {}) })
        result = 'OK'
      }
    } else if (operation === 'EVAL') {
      const [script, keyCount, key, value, seconds] = args
      expect(keyCount).toBe(1)
      if (String(script).includes('redis.call("DEL"')) {
        result = get(String(key)) === String(value) ? Number(values.delete(String(key))) : 0
      } else {
        const current = Number(get(String(key)) ?? 0)
        result = Math.max(current, Number(value))
        if (Number(value) > current) values.set(String(key), { value: String(value), expiresAt: Date.now() + Number(seconds) * 1000 })
      }
    } else throw new Error(`Unexpected command: ${operation}`)
    return Response.json({ result })
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, commands }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-01T10:00:00Z'))
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('distributed Spotify state through the production Redis adapter', () => {
  it.each([new SpotifyTimeoutError(), new SpotifyRequestError(500), new Error('network failure')])('shares upstream failure backoff across cold instances: %s', async (error) => {
    redisTransport()
    const getPlayback = vi.fn().mockRejectedValue(error)
    const first = createNowPlayingService({ stateStore: createUpstashSpotifyStateStore(), getPlayback })
    expect(await first()).toMatchObject({ kind: 'unavailable', retryAfterSeconds: 60 })
    vi.advanceTimersByTime(10_000)
    const second = createNowPlayingService({ stateStore: createUpstashSpotifyStateStore(), getPlayback })
    expect(await second()).toEqual({ kind: 'unavailable', status: 503, retryAfterSeconds: 50 })
    expect(await second()).toMatchObject({ retryAfterSeconds: 50 })
    expect(getPlayback).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(50_001)
    getPlayback.mockResolvedValue(playing)
    expect(await second()).toEqual({ kind: 'playback', playback: playing })
    expect(getPlayback).toHaveBeenCalledTimes(2)
  })

  it('preserves a shared track as recent during timeout backoff', async () => {
    redisTransport()
    const store = createUpstashSpotifyStateStore()
    await store.writeSnapshot({ playback: playing, fetchedAt: Date.now() - 120_001 })
    const getPlayback = vi.fn().mockRejectedValue(new SpotifyTimeoutError())
    const first = createNowPlayingService({ stateStore: store, getPlayback })
    const second = createNowPlayingService({ stateStore: createUpstashSpotifyStateStore(), getPlayback })
    const expected = { kind: 'playback', playback: { status: 'recent', track }, stale: true, retryAfterSeconds: 60 }
    expect(await first()).toEqual(expected)
    expect(await second()).toEqual(expected)
    expect(getPlayback).toHaveBeenCalledTimes(1)
  })

  it.each(['cooldown', 'backoff', 'snapshot'])('rereads %s published before acquiring the lock', async (update) => {
    redisTransport()
    const firstStore = createUpstashSpotifyStateStore()
    const otherStore = createUpstashSpotifyStateStore()
    const acquire = firstStore.acquireRefreshLock.bind(firstStore)
    firstStore.acquireRefreshLock = async () => {
      if (update === 'cooldown') await otherStore.extendCooldown(90)
      if (update === 'backoff') await otherStore.extendBackoff(60)
      if (update === 'snapshot') await otherStore.writeSnapshot({ playback: playing, fetchedAt: Date.now() })
      return acquire()
    }
    const getPlayback = vi.fn().mockResolvedValue(playing)
    const service = createNowPlayingService({ stateStore: firstStore, getPlayback })
    const outcome = await service()
    expect(outcome.kind).toBe(update === 'snapshot' ? 'playback' : update === 'cooldown' ? 'rate-limited' : 'unavailable')
    expect(getPlayback).not.toHaveBeenCalled()
    expect(await otherStore.acquireRefreshLock()).not.toBeNull()
  })

  it('coalesces independent instances and persists snapshots', async () => {
    redisTransport()
    const deferred = Promise.withResolvers<typeof playing>()
    const started = Promise.withResolvers<void>()
    const getPlayback = vi.fn(() => { started.resolve(); return deferred.promise })
    const first = createNowPlayingService({ stateStore: createUpstashSpotifyStateStore(), getPlayback })
    const second = createNowPlayingService({ stateStore: createUpstashSpotifyStateStore(), getPlayback })
    const pending = first()
    await started.promise
    expect(getPlayback).toHaveBeenCalledTimes(1)
    expect(await second()).toEqual({ kind: 'unavailable', status: 503, retryAfterSeconds: 5 })
    deferred.resolve(playing)
    await pending
    expect(await second()).toEqual({ kind: 'playback', playback: playing })
    expect(getPlayback).toHaveBeenCalledTimes(1)
  })

  it('never shortens backoff and cannot release another instance’s lock', async () => {
    redisTransport()
    const first = createUpstashSpotifyStateStore()
    const second = createUpstashSpotifyStateStore()
    const until = await first.extendBackoff(90)
    expect(await second.extendBackoff(10)).toBe(until)
    const oldToken = await first.acquireRefreshLock()
    expect(await second.acquireRefreshLock()).toBeNull()
    vi.advanceTimersByTime(30_001)
    const newToken = await second.acquireRefreshLock()
    expect(newToken).not.toBeNull()
    await first.releaseRefreshLock(oldToken!)
    expect(await first.acquireRefreshLock()).toBeNull()
    await second.releaseRefreshLock(newToken!)
    expect(await first.acquireRefreshLock()).not.toBeNull()
  })

  it('fails closed when Redis is unavailable', async () => {
    const { fetch } = redisTransport()
    fetch.mockResolvedValue(Response.json({ error: 'unavailable' }, { status: 503 }))
    const getPlayback = vi.fn().mockResolvedValue(playing)
    const service = createNowPlayingService({ stateStore: createUpstashSpotifyStateStore(), getPlayback })
    expect(await service()).toMatchObject({ kind: 'unavailable', status: 503 })
    expect(getPlayback).not.toHaveBeenCalled()
  })
})


describe('production endpoint configuration', () => {
  it('shares failure backoff across independently loaded endpoint modules', async () => {
    const { fetch: redisFetch } = redisTransport()
    let upstreamCalls = 0
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client')
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === 'https://redis.example.test') return redisFetch(input, init)
      if (String(input) === 'https://accounts.spotify.com/api/token') return Response.json({ access_token: 'test-access', expires_in: 3600 })
      upstreamCalls += 1
      return Response.json({ error: 'upstream failure' }, { status: 500 })
    }))
    async function coldRequest() {
      vi.resetModules()
      const { default: handler } = await import('../api/now-playing')
      const headers = new Map<string, string>()
      const response = {
        statusCode: 200,
        body: undefined as unknown,
        setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); return this },
        status(status: number) { this.statusCode = status; return this },
        json(body: unknown) { this.body = body; return this },
      }
      await handler({ method: 'GET', query: {} } as VercelRequest, response as unknown as VercelResponse)
      return { ...response, headers }
    }
    const first = await coldRequest()
    expect(first.statusCode).toBe(502)
    expect(first.headers.get('retry-after')).toBe('60')
    vi.advanceTimersByTime(10_000)
    const second = await coldRequest()
    expect(second.statusCode).toBe(503)
    expect(second.headers.get('retry-after')).toBe('50')
    expect(second.headers.get('cache-control')).toBe('no-store')
    expect(upstreamCalls).toBe(1)
  })
})
