import process from "node:process"

import type { VercelRequest, VercelResponse } from "@vercel/node"

const KEY = "site:visitors:v1"
const REQUEST_TIMEOUT_MS = 2_000

function getRedisCredentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (url || token) return { url, token }
  return {
    url: process.env.KV_REST_API_URL?.trim(),
    token: process.env.KV_REST_API_TOKEN?.trim(),
  }
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

// GET reads the count. POST counts one new visitor; the browser sends it once.
// Only the production deployment counts. `vercel dev` and previews share the
// same Redis, so their POSTs just read the count.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store")

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const counts = req.method === "POST" && process.env.VERCEL_ENV === "production"
    const value = await redis(counts ? ["INCR", KEY] : ["GET", KEY])
    return res.status(200).json({ value })
  } catch {
    return res.status(503).json({ error: "Visitor count is temporarily unavailable" })
  }
}
