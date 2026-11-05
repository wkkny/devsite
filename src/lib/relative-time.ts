const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const YEAR = 365 * DAY

// Compact "2h ago" style, matching the muted metadata elsewhere on the page.
export function formatRelativeTime(timestamp: number, now: number) {
  const elapsed = Math.max(0, now - timestamp)

  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`
  if (elapsed < YEAR) return `${Math.floor(elapsed / WEEK)}w ago`
  return `${Math.floor(elapsed / YEAR)}y ago`
}
