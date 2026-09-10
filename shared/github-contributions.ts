export type GitHubContributionLevel = 0 | 1 | 2 | 3 | 4

export interface GitHubContribution {
  date: string
  count: number
  level: GitHubContributionLevel
}

export interface GitHubContributionsResponse {
  contributions: GitHubContribution[]
}

const MAX_CONTRIBUTION_DAYS = 400
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false

  const timestamp = Date.parse(`${value}T00:00:00.000Z`)

  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  )
}

function isContributionLevel(value: unknown): value is GitHubContributionLevel {
  return Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= 4
}

/**
 * Validates an upstream/API response and returns only the fields used by the UI.
 */
export function parseGitHubContributionsResponse(
  value: unknown
): GitHubContributionsResponse | null {
  if (!isRecord(value) || !Array.isArray(value.contributions)) return null
  if (value.contributions.length > MAX_CONTRIBUTION_DAYS) return null

  const seenDates = new Set<string>()
  const contributions: GitHubContribution[] = []

  for (const valueEntry of value.contributions) {
    if (!isRecord(valueEntry)) return null

    const { date, count, level } = valueEntry

    if (
      !isCalendarDate(date) ||
      seenDates.has(date) ||
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      !isContributionLevel(level)
    ) {
      return null
    }

    seenDates.add(date)
    contributions.push({ date, count, level })
  }

  return { contributions }
}

export function isGitHubContributionsResponse(
  value: unknown
): value is GitHubContributionsResponse {
  return parseGitHubContributionsResponse(value) !== null
}
