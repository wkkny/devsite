import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from '../src/lib/relative-time'

const now = Date.UTC(2026, 10, 6, 12)
const minutes = (value: number) => now - value * 60_000

describe('formatRelativeTime', () => {
  it.each([
    [minutes(0), 'just now'],
    [minutes(0.9), 'just now'],
    [minutes(5), '5m ago'],
    [minutes(59), '59m ago'],
    [minutes(60), '1h ago'],
    [minutes(23 * 60 + 59), '23h ago'],
    [minutes(24 * 60), '1d ago'],
    [minutes(7 * 24 * 60), '1w ago'],
    [minutes(400 * 24 * 60), '1y ago'],
  ])('formats %i', (timestamp, expected) => {
    expect(formatRelativeTime(timestamp, now)).toBe(expected)
  })

  it('treats a timestamp in the future as just now', () => {
    expect(formatRelativeTime(now + 60_000, now)).toBe('just now')
  })
})
