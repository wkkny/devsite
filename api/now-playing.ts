import type { VercelRequest, VercelResponse } from "@vercel/node"

import { createNowPlayingService } from "./_now-playing-service.js"
import { getLastfmPlayback } from "./_lastfm.js"
import { getSpotifyStateStore } from "./_spotify-store.js"

const CACHE_CONTROL =
  "public, max-age=0, s-maxage=30, stale-while-revalidate=30"

const getNowPlaying = createNowPlayingService({
  stateStore: getSpotifyStateStore(),
  getPlayback: getLastfmPlayback,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    res.setHeader("Cache-Control", "no-store")
    return res.status(405).json({ error: "Method not allowed" })
  }

  // The CDN caches this response for 30 seconds, keyed by URL. Each new query string would
  // miss that cache, so `?x=1`, `?x=2`, … could reach Last.fm on every request.
  if (Object.keys(req.query ?? {}).length > 0) {
    res.setHeader("Cache-Control", "no-store")
    return res.status(400).json({ error: "Unexpected query parameters" })
  }

  const outcome = await getNowPlaying()

  if (outcome.kind === "playback") {
    if (outcome.retryAfterSeconds !== undefined) {
      res.setHeader("Retry-After", String(outcome.retryAfterSeconds))
    }
    res.setHeader(
      "Cache-Control",
      outcome.stale || outcome.retryAfterSeconds !== undefined
        ? "no-store"
        : CACHE_CONTROL,
    )
    return res.status(200).json(outcome.playback)
  }

  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Retry-After", String(outcome.retryAfterSeconds ?? 60))

  if (outcome.kind === "rate-limited") {
    return res.status(429).json({ error: "Spotify is temporarily rate limited" })
  }

  return res
    .status(outcome.status)
    .json({ error: "Spotify playback is temporarily unavailable" })
}
