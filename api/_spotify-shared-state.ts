import { randomUUID } from "node:crypto"
import process from "node:process"

import {
  isNowPlayingResponse,
  type NowPlayingResponse,
} from "../shared/now-playing.js"

const SNAPSHOT_KEY = "spotify:now-playing:snapshot:v1"
const COOLDOWN_KEY = "spotify:now-playing:cooldown-until:v1"
const REFRESH_LOCK_KEY = "spotify:now-playing:refresh-lock:v1"
const REQUEST_TIMEOUT_MS = 2_000
const REFRESH_LOCK_SECONDS = 30

const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`

const EXTEND_COOLDOWN_SCRIPT = `
  local current = tonumber(redis.call("GET", KEYS[1]) or "0")
  local proposed = tonumber(ARGV[1])
  if proposed > current then
    redis.call("SET", KEYS[1], proposed, "EX", ARGV[2])
    return proposed
  end
  return current
`

export type StoredSnapshot = {
  playback: NowPlayingResponse
  fetchedAt: number
  recentlyPlayedAt?: number
}

export type SharedSpotifyState = {
  snapshot: StoredSnapshot | null
  cooldownUntil: number
}

export interface SpotifyStateStore {
  read(): Promise<SharedSpotifyState>
  writeSnapshot(snapshot: StoredSnapshot): Promise<void>
  extendCooldown(retryAfterSeconds: number): Promise<number>
  acquireRefreshLock(): Promise<string | null>
  releaseRefreshLock(token: string): Promise<void>
}

type RedisResponse = {
  result?: unknown
  error?: unknown
}

export class SpotifySharedStateError extends Error {
  constructor(message = "Spotify shared state is unavailable") {
    super(message)
    this.name = "SpotifySharedStateError"
  }
}

export function hasSpotifySharedStateConfiguration() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  )
}

export function requiresSpotifySharedState() {
  return process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview"
}

function getConfiguration() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (!url || !token) {
    throw new SpotifySharedStateError("Spotify shared state is not configured")
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new SpotifySharedStateError("Spotify shared state URL is invalid")
  }

  if (parsedUrl.protocol !== "https:") {
    throw new SpotifySharedStateError("Spotify shared state URL must use HTTPS")
  }

  return { url: parsedUrl.toString().replace(/\/$/, ""), token }
}

async function runRedisCommand<T>(command: Array<string | number>): Promise<T> {
  const { url, token } = getConfiguration()
  let response: Response

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new SpotifySharedStateError()
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new SpotifySharedStateError()
  }

  if (typeof payload !== "object" || payload === null) {
    throw new SpotifySharedStateError()
  }

  const redisResponse = payload as RedisResponse
  if (!response.ok || typeof redisResponse.error === "string") {
    throw new SpotifySharedStateError()
  }

  return redisResponse.result as T
}

function parseSnapshot(value: unknown): StoredSnapshot | null {
  if (typeof value !== "string") return null

  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== "object" || parsed === null) return null

    const record = parsed as Record<string, unknown>
    if (!isNowPlayingResponse(record.playback)) return null
    if (typeof record.fetchedAt !== "number" || !Number.isFinite(record.fetchedAt)) {
      return null
    }

    const recentlyPlayedAt = record.recentlyPlayedAt
    return {
      playback: record.playback,
      fetchedAt: record.fetchedAt,
      ...(typeof recentlyPlayedAt === "number" && Number.isFinite(recentlyPlayedAt)
        ? { recentlyPlayedAt }
        : {}),
    }
  } catch {
    return null
  }
}

export function createUpstashSpotifyStateStore(): SpotifyStateStore {
  return {
    async read() {
      const values = await runRedisCommand<Array<string | null>>([
        "MGET",
        SNAPSHOT_KEY,
        COOLDOWN_KEY,
      ])

      if (!Array.isArray(values) || values.length !== 2) {
        throw new SpotifySharedStateError()
      }

      const cooldownValue = Number(values[1])
      return {
        snapshot: parseSnapshot(values[0]),
        cooldownUntil:
          Number.isFinite(cooldownValue) && cooldownValue > 0 ? cooldownValue : 0,
      }
    },

    async writeSnapshot(snapshot) {
      await runRedisCommand<string>([
        "SET",
        SNAPSHOT_KEY,
        JSON.stringify(snapshot),
      ])
    },

    async extendCooldown(retryAfterSeconds) {
      const safeSeconds = Math.max(1, Math.ceil(retryAfterSeconds))
      const proposedUntil = Date.now() + safeSeconds * 1_000
      const result = await runRedisCommand<number>([
        "EVAL",
        EXTEND_COOLDOWN_SCRIPT,
        1,
        COOLDOWN_KEY,
        proposedUntil,
        safeSeconds,
      ])

      return Number.isFinite(result) ? result : proposedUntil
    },

    async acquireRefreshLock() {
      const token = randomUUID()
      const result = await runRedisCommand<string | null>([
        "SET",
        REFRESH_LOCK_KEY,
        token,
        "EX",
        REFRESH_LOCK_SECONDS,
        "NX",
      ])

      return result === "OK" ? token : null
    },

    async releaseRefreshLock(token) {
      await runRedisCommand<number>([
        "EVAL",
        RELEASE_LOCK_SCRIPT,
        1,
        REFRESH_LOCK_KEY,
        token,
      ])
    },
  }
}
