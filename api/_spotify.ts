import { Buffer } from "node:buffer"
import process from "node:process"

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
const REQUEST_TIMEOUT_MS = 4_000
const TOKEN_EXPIRY_BUFFER_MS = 30_000

type SpotifyTokenResponse = {
  access_token: string
  expires_in: number
}

let cachedAccessToken: { value: string; expiresAt: number } | undefined
let refreshInFlight: Promise<string> | undefined

export class SpotifyRequestError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number | null
  readonly reason: string | null
  readonly endpoint: string

  constructor(
    status: number,
    retryAfterSeconds: number | null = null,
    reason: string | null = null,
    endpoint = "web-api",
  ) {
    super("Spotify request failed")
    this.name = "SpotifyRequestError"
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.reason = reason
    this.endpoint = endpoint
  }
}

export class SpotifyConfigurationError extends Error {
  constructor() {
    super("Spotify is not configured")
    this.name = "SpotifyConfigurationError"
  }
}

export class SpotifyTimeoutError extends Error {
  constructor() {
    super("Spotify request timed out")
    this.name = "SpotifyTimeoutError"
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new SpotifyConfigurationError()
  }

  return value
}

function getAuthorizationHeader() {
  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID")
  const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET")

  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
}

export function getRetryAfterSeconds(response: Response) {
  const header = response.headers.get("retry-after")
  if (header === null) return null

  const seconds = Number(header)

  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)

  const retryAt = Date.parse(header)

  return Number.isNaN(retryAt)
    ? null
    : Math.max(Math.ceil((retryAt - Date.now()) / 1_000), 0)
}

function safeSpotifyErrorReason(value: unknown) {
  if (typeof value !== "string") return null
  return /^[A-Z0-9_-]{1,80}$/.test(value) ? value : null
}

export async function getSpotifyErrorReason(response: Response) {
  try {
    const data: unknown = await response.clone().json()
    if (typeof data !== "object" || data === null) return null

    const record = data as Record<string, unknown>
    const nestedError = record.error

    if (typeof nestedError === "object" && nestedError !== null) {
      const nestedReason = safeSpotifyErrorReason(
        (nestedError as Record<string, unknown>).reason,
      )
      if (nestedReason) return nestedReason
    }

    return safeSpotifyErrorReason(record.reason)
  } catch {
    return null
  }
}

async function requestAccessToken() {
  let response: Response

  try {
    response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: getAuthorizationHeader(),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: getRequiredEnv("SPOTIFY_REFRESH_TOKEN"),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SpotifyTimeoutError()
    }

    throw error
  }

  if (!response.ok) {
    throw new SpotifyRequestError(
      response.status,
      getRetryAfterSeconds(response),
      await getSpotifyErrorReason(response),
      "token",
    )
  }

  const data: unknown = await response.json()

  if (
    typeof data !== "object" ||
    data === null ||
    !("access_token" in data) ||
    typeof data.access_token !== "string" ||
    !("expires_in" in data) ||
    typeof data.expires_in !== "number" ||
    data.expires_in <= 0
  ) {
    throw new Error("Invalid Spotify token response")
  }

  const token = data as SpotifyTokenResponse
  cachedAccessToken = {
    value: token.access_token,
    expiresAt:
      Date.now() +
      Math.max(0, token.expires_in * 1_000 - TOKEN_EXPIRY_BUFFER_MS),
  }

  return token.access_token
}

export async function getSpotifyAccessToken(forceRefresh = false) {
  if (
    !forceRefresh &&
    cachedAccessToken &&
    cachedAccessToken.expiresAt > Date.now()
  ) {
    return cachedAccessToken.value
  }

  if (refreshInFlight) {
    return refreshInFlight
  }

  if (forceRefresh) {
    cachedAccessToken = undefined
  }

  refreshInFlight = requestAccessToken()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = undefined
  }
}
