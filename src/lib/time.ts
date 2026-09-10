import { portfolio } from '@/config/portfolio'

function formatOwnerTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: portfolio.profile.location.timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatTimeDifference(date: Date, viewerTimeZone: string): string {
  const difference = getTimeZoneOffset(date, portfolio.profile.location.timeZone) - getTimeZoneOffset(date, viewerTimeZone)

  if (difference === 0) return 'same time'

  const absoluteDifference = Math.abs(difference)
  const hours = Math.floor(absoluteDifference / 60)
  const minutes = absoluteDifference % 60
  const parts = [
    hours > 0 ? `${hours}h` : '',
    minutes > 0 ? `${minutes}m` : '',
  ].filter(Boolean)

  return `${parts.join(' ')} ${difference > 0 ? 'ahead' : 'behind'}`
}

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const timeZoneTime = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )

  return Math.round((timeZoneTime - date.getTime()) / 60000)
}

export { formatOwnerTime, formatTimeDifference }
