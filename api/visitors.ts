import { createHash } from "node:crypto"
import process from "node:process"

import type { VercelRequest, VercelResponse } from "@vercel/node"

const KEY = "site:visitors:v1"
const SEEN_KEY_PREFIX = "site:visitors:seen:v1:"
// An address counts at most once in this window, however many POSTs it sends.
const SEEN_TTL_SECONDS = 24 * 60 * 60
const REQUEST_TIMEOUT_MS = 2_000

// Counts only when this address hasn't been seen in the window, in one round trip.
const COUNT_ONCE_SCRIPT = `
  if redis.call("SET", KEYS[2], "1", "NX", "EX", ARGV[1]) then
    return redis.call("INCR", KEYS[1])
  end
  return tonumber(redis.call("GET", KEYS[1]) or "0")
`

function getRedisCredentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (url || token) return { url, token }
  return {
    url: process.env.KV_REST_API_URL?.trim(),
    token: process.env.KV_REST_API_TOKEN?.trim(),
  }
}

// Vercel sets these headers itself, so the client can't spoof them. Only a hash is stored.
function visitorKey(req: VercelRequest) {
  const header = (name: string) => [req.headers[name]].flat()[0]
  const address = (header("x-real-ip") ?? header("x-forwarded-for")?.split(",")[0])?.trim()
  if (!address) return null
  return SEEN_KEY_PREFIX + createHash("sha256").update(address).digest("hex")
}

async function redis(command: string[]): Promise<number> {
  const { url, token } = getRedisCredentials()
  if (!url || !token) throw new Error("Redis is not configured")

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Redis responded ${response.status}`)

  const { result } = (await response.json()) as { result?: unknown }
  const value = Number(result ?? 0)
  if (!Number.isFinite(value)) throw new Error("Unexpected Redis result")
  return value
}

// GET reads the count. POST counts one new visitor; the browser sends it once, and
// the server ignores repeats from the same address for a day.
// Only the production deployment counts. `vercel dev` and previews share the
// same Redis, so their POSTs just read the count.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store")

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const seenKey = req.method === "POST" && process.env.VERCEL_ENV === "production" ? visitorKey(req) : null
    const value = await redis(
      seenKey ? ["EVAL", COUNT_ONCE_SCRIPT, "2", KEY, seenKey, String(SEEN_TTL_SECONDS)] : ["GET", KEY],
    )
    return res.status(200).json({ value })
  } catch {
    return res.status(503).json({ error: "Visitor count is temporarily unavailable" })
  }
}
