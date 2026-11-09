import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../api/visitors'

const REDIS_URL = 'https://redis.example.test'

function makeResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader() {
      return this
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
  }
  return response
}

async function invoke(method: string, headers: Record<string, string> = {}) {
  const response = makeResponse()
  await handler({ method, headers } as unknown as VercelRequest, response as unknown as VercelResponse)
  return response
}

// A tiny Redis stand-in that understands the commands the handler sends.
function mockRedis() {
  let count = 0
  const seen = new Set<string>()
  const commands: string[][] = []
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const command = JSON.parse(String(init.body)) as string[]
    commands.push(command)
    if (command[0] === 'EVAL') {
      const seenKey = command[4]
      if (!seen.has(seenKey)) {
        seen.add(seenKey)
        count += 1
      }
    }
    return new Response(JSON.stringify({ result: command[0] === 'GET' ? String(count) : count }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return { commands, fetchMock }
}

describe('visitors API', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', REDIS_URL)
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token')
    vi.stubEnv('VERCEL_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('counts an address once, however many times it posts', async () => {
    mockRedis()

    const first = await invoke('POST', { 'x-real-ip': '203.0.113.7' })
    const repeat = await invoke('POST', { 'x-real-ip': '203.0.113.7' })
    const other = await invoke('POST', { 'x-forwarded-for': '198.51.100.2, 10.0.0.1' })

    expect(first.body).toEqual({ value: 1 })
    expect(repeat.body).toEqual({ value: 1 })
    expect(other.body).toEqual({ value: 2 })
  })

  it('stores a hash of the address, not the address itself', async () => {
    const { commands } = mockRedis()

    await invoke('POST', { 'x-real-ip': '203.0.113.7' })

    const [, , , , seenKey, ttl] = commands[0]
    expect(seenKey).toMatch(/^site:visitors:seen:v1:[0-9a-f]{64}$/)
    expect(seenKey).not.toContain('203.0.113.7')
    expect(ttl).toBe(String(24 * 60 * 60))
  })

  it('only reads the count when the address is unknown', async () => {
    const { commands } = mockRedis()

    const response = await invoke('POST')

    expect(response.body).toEqual({ value: 0 })
    expect(commands).toEqual([['GET', 'site:visitors:v1']])
  })

  it('only reads the count outside production', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const { commands } = mockRedis()

    await invoke('POST', { 'x-real-ip': '203.0.113.7' })

    expect(commands).toEqual([['GET', 'site:visitors:v1']])
  })

  it('reports 503 when Redis is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))

    const response = await invoke('POST', { 'x-real-ip': '203.0.113.7' })

    expect(response.statusCode).toBe(503)
  })
})
