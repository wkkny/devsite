import type { VercelRequest, VercelResponse } from "@vercel/node"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { portfolio } from "../src/config/portfolio.js"
import {
  isGitHubContributionsResponse,
  parseGitHubContributionsResponse,
} from "../shared/github-contributions.js"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

function createResponse() {
  const state: {
    body?: unknown
    status?: number
    headers: Map<string, string | number | readonly string[]>
  } = { headers: new Map() }
  const response = {
    setHeader: vi.fn(
      (name: string, value: string | number | readonly string[]) => {
        state.headers.set(name.toLowerCase(), value)
        return response
      }
    ),
    status: vi.fn((status: number) => {
      state.status = status
      return response
    }),
    json: vi.fn((body: unknown) => {
      state.body = body
      return response
    }),
  }

  return { response: response as unknown as VercelResponse, state }
}

async function invoke(method: string, query: VercelRequest["query"] = {}) {
  const { default: handler } = await import("../api/github-contributions.js")
  const { response, state } = createResponse()

  await handler({ method, query } as VercelRequest, response)

  return state
}

describe("GitHub contributions API", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("fetches only the configured owner and returns a minimal cached DTO", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        total: { 2026: 3 },
        contributions: [
          {
            date: "2026-09-11",
            count: 3,
            level: 2,
            color: "#40c463",
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("GET")

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://github-contributions-api.jogruber.de/v4/${portfolio.links.github.username}`
        + "?y=last"
    )
    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      contributions: [{ date: "2026-09-11", count: 3, level: 2 }],
    })
    expect(result.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
    )
  })

  it("rejects non-GET requests without calling upstream", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("POST")

    expect(result.status).toBe(405)
    expect(result.headers.get("allow")).toBe("GET")
    expect(result.headers.get("cache-control")).toBe("no-store")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects query parameters without calling upstream", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    const result = await invoke("GET", { bypass: "1" })

    expect(result.status).toBe(400)
    expect(result.body).toEqual({ error: "Unexpected query parameters" })
    expect(result.headers.get("cache-control")).toBe("no-store")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not cache malformed upstream data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          contributions: [{ date: "2026-02-30", count: 1, level: 1 }],
        })
      )
    )

    const result = await invoke("GET")

    expect(result.status).toBe(502)
    expect(result.headers.get("cache-control")).toBe("no-store")
    expect(result.body).toEqual({
      error: "GitHub contributions are temporarily unavailable",
    })
  })
})

describe("shared GitHub contributions validation", () => {
  it("removes fields outside the public DTO", () => {
    expect(
      parseGitHubContributionsResponse({
        total: 7,
        contributions: [
          { date: "2026-09-11", count: 7, level: 4, color: "green" },
        ],
      })
    ).toEqual({
      contributions: [{ date: "2026-09-11", count: 7, level: 4 }],
    })
  })

  it.each([
    null,
    {},
    { contributions: "not-an-array" },
    { contributions: [{ date: "2026-02-30", count: 1, level: 1 }] },
    { contributions: [{ date: "2026-09-11", count: -1, level: 1 }] },
    { contributions: [{ date: "2026-09-11", count: 1, level: 5 }] },
    {
      contributions: [
        { date: "2026-09-11", count: 1, level: 1 },
        { date: "2026-09-11", count: 2, level: 2 },
      ],
    },
  ])("rejects malformed contribution data", (value) => {
    expect(parseGitHubContributionsResponse(value)).toBeNull()
    expect(isGitHubContributionsResponse(value)).toBe(false)
  })

  it("accepts a valid minimal response", () => {
    const response = {
      contributions: [{ date: "2024-02-29", count: 0, level: 0 }],
    }

    expect(isGitHubContributionsResponse(response)).toBe(true)
  })
})
