export type ContributionDay = {
  date: string
  count: number
  level: number
}

function isContributionDay(value: unknown): value is ContributionDay {
  if (typeof value !== 'object' || value === null) return false

  const day = value as Record<string, unknown>

  return (
    typeof day.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    typeof day.count === 'number' &&
    Number.isInteger(day.count) &&
    day.count >= 0 &&
    typeof day.level === 'number' &&
    Number.isInteger(day.level) &&
    day.level >= 0 &&
    day.level <= 4
  )
}

export function parseContributions(data: unknown): ContributionDay[] {
  if (typeof data !== 'object' || data === null || !('contributions' in data)) {
    throw new Error('Invalid GitHub contributions response')
  }

  const contributions = data.contributions

  if (
    !Array.isArray(contributions) ||
    !contributions.every(isContributionDay)
  ) {
    throw new Error('Invalid GitHub contributions response')
  }

  return contributions
}
