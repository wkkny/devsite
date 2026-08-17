import { Buffer } from "node:buffer"
import process from "node:process"

import type { VercelResponse } from "@vercel/node"

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
const ACCESS_TOKEN_COOKIE = "spotify_access_token"
const REFRESH_TOKEN_COOKIE = "spotify_refresh_token"
const ONE_YEAR_IN_SECONDS = 31_536_000

export const SPOTIFY_SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-recently-played",
].join(" ")

export type SpotifyCookies = {
  accessToken?: string
  refreshToken?: string
}

type SpotifyTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

export function getRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function getSpotifyConfig() {
  return {
    clientId: getRequiredEnv("VITE_SPOTIFY_CLIENT_ID"),
    clientSecret: getRequiredEnv("SPOTIFY_CLIENT_SECRET"),
    redirectUri: getRequiredEnv("VITE_SPOTIFY_REDIRECT_URI"),
  }
}

export function getAuthorizationHeader() {
  const { clientId, clientSecret } = getSpotifyConfig()

  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
}

export function parseCookies(cookieHeader: string | undefined) {
  const cookies: Record<string, string> = {}

  if (!cookieHeader) {
    return cookies
  }

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...value] = cookie.split("=")

    if (!name) {
      continue
    }

    cookies[name.trim()] = decodeURIComponent(value.join("=").trim())
  }

  return cookies
}

export function isPrivateSpotifyAuthMode() {
  return process.env.VITE_SPOTIFY_AUTH_MODE === "private"
}

export function getSpotifyCookies(
  cookieHeader: string | undefined
): SpotifyCookies {
  const cookies = parseCookies(cookieHeader)

  return {
    accessToken: cookies[ACCESS_TOKEN_COOKIE],
    refreshToken: cookies[REFRESH_TOKEN_COOKIE],
  }
}

function serializeCookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""

  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly${secure}; SameSite=Lax`
}

export function setSpotifyCookies(
  res: VercelResponse,
  token: Pick<
    SpotifyTokenResponse,
    "access_token" | "expires_in" | "refresh_token"
  >
) {
  const cookies = [
    serializeCookie(ACCESS_TOKEN_COOKIE, token.access_token, token.expires_in),
  ]

  if (token.refresh_token) {
    cookies.push(
      serializeCookie(
        REFRESH_TOKEN_COOKIE,
        token.refresh_token,
        ONE_YEAR_IN_SECONDS
      )
    )
  }

  res.setHeader("Set-Cookie", cookies)
}

export function clearSpotifyCookies(res: VercelResponse) {
  res.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_TOKEN_COOKIE, "", 0),
    serializeCookie(REFRESH_TOKEN_COOKIE, "", 0),
  ])
}

async function requestToken(body: URLSearchParams) {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: getAuthorizationHeader(),
    },
    body,
  })
  const data = (await response.json()) as Partial<SpotifyTokenResponse> & {
    error?: string
    error_description?: string
  }

  if (!response.ok || data.error || !data.access_token || !data.expires_in) {
    throw new Error(
      data.error_description ?? data.error ?? "Spotify token request failed"
    )
  }

  return data as SpotifyTokenResponse
}

export function exchangeCodeForToken(code: string) {
  const { redirectUri } = getSpotifyConfig()

  return requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    })
  )
}

export function refreshAccessToken(refreshToken: string) {
  return requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  )
}
