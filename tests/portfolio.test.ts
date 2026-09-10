import { describe, expect, it } from 'vitest'

import { portfolio } from '../src/config/portfolio.js'

describe('portfolio config', () => {
  it('derives owner links from their canonical values', () => {
    expect(portfolio.links.github.username).toBe('wkkny')
    expect(portfolio.links.email.href).toBe(
      `mailto:${portfolio.links.email.address}`,
    )
    expect(portfolio.links.github.href).toBe(
      `https://github.com/${portfolio.links.github.username}`,
    )
  })

  it('only uses actionable HTTPS project destinations', () => {
    for (const project of portfolio.projects) {
      const destinations = Object.values(project.destinations)

      for (const destination of destinations) {
        expect(destination.startsWith('https://')).toBe(true)
      }
    }
  })
})
