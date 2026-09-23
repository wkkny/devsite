import { describe, expect, it } from 'vitest'

import { parseContributions } from '../shared/github-activity'

describe('parseContributions', () => {
  it('accepts a valid contribution response', () => {
    const contributions = [{ date: '2026-09-23', count: 3, level: 2 }]

    expect(parseContributions({ contributions })).toEqual(contributions)
  })

  it.each([
    null,
    {},
    { contributions: null },
    { contributions: {} },
    { contributions: [null] },
    { contributions: [{ date: '2026-09-23', count: '3', level: 2 }] },
    { contributions: [{ date: '2026-09-23', count: 3, level: 5 }] },
  ])('rejects malformed payloads: %s', (payload) => {
    expect(() => parseContributions(payload)).toThrow(
      'Invalid GitHub contributions response',
    )
  })
})
