import type { VercelRequest, VercelResponse } from "@vercel/node"

import { parseGitHubContributionsResponse } from "../shared/github-contributions.js"
import { portfolio } from "../src/config/portfolio.js"

const CONTRIBUTIONS_URL = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(portfolio.links.github.username)}?y=last`
const REQUEST_TIMEOUT_MS = 5_000
const CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    res.setHeader("Cache-Control", "no-store")
    return res.status(405).json({ error: "Method not allowed" })
  }

  if (Object.keys(req.query ?? {}).length > 0) {
    res.setHeader("Cache-Control", "no-store")
    return res.status(400).json({ error: "Unexpected query parameters" })
  }

  try {
    const response = await fetch(CONTRIBUTIONS_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error("[github-contributions] upstream request failed", {
        status: response.status,
      })
      res.setHeader("Cache-Control", "no-store")
      return res
        .status(response.status === 429 ? 503 : 502)
        .json({ error: "GitHub contributions are temporarily unavailable" })
    }

    const data: unknown = await response.json()
    const result = parseGitHubContributionsResponse(data)

    if (!result) {
      throw new Error("Invalid GitHub contributions response")
    }

    res.setHeader("Cache-Control", CACHE_CONTROL)
    return res.status(200).json(result)
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError"

    console.error(
      timedOut
        ? "[github-contributions] upstream request timed out"
        : "[github-contributions] request failed"
    )
    res.setHeader("Cache-Control", "no-store")
    return res
      .status(timedOut ? 504 : 502)
      .json({ error: "GitHub contributions are temporarily unavailable" })
  }
}
